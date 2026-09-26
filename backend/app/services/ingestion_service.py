import asyncio
import logging
from typing import Any

from app.config import settings
from app.db.repository import insert_events, record_ingest_log
from app.db.session import get_db_connection
from app.services.cache_service import cache_service
from app.services.gdelt_client import GDELTClient
from app.services.groq_service import GroqAIService

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self):
        self.gdelt_client = GDELTClient()
        self.groq_service = GroqAIService()
        self._is_running = False

    async def run_pipeline(self, max_records: int | None = None) -> dict[str, Any]:
        """
        Executes a single end-to-end ingestion and AI enrichment cycle.
        """
        records_limit = max_records or settings.MAX_EVENTS_PER_INGEST
        logger.info(f"Starting happening-board ingestion cycle (limit={records_limit})...")

        # 1. Fetch raw events from GDELT
        raw_events = await self.gdelt_client.fetch_latest_events(max_records=records_limit)
        fetched_count = len(raw_events)

        if not raw_events:
            logger.info("No new matching events found in current GDELT cycle.")
            async with get_db_connection() as conn:
                await record_ingest_log(conn, fetched=0, saved=0, ai_count=0, status="EMPTY", details="No conflict records found")
            return {"status": "success", "fetched": 0, "saved": 0, "ai_processed": 0}

        # 2. Enrich with Groq AI (with heuristic fallback)
        logger.info(f"Enriching {fetched_count} events with Groq AI layer...")
        enriched_events = await self.groq_service.enrich_events(raw_events)
        ai_processed_count = sum(1 for e in enriched_events if e.ai_processed)

        # 3. Store to PostgreSQL database
        async with get_db_connection() as conn:
            saved_count = await insert_events(conn, enriched_events)
            log_details = f"Groq active: {self.groq_service.is_available}, AI enriched: {ai_processed_count}/{fetched_count}"
            await record_ingest_log(
                conn,
                fetched=fetched_count,
                saved=saved_count,
                ai_count=ai_processed_count,
                status="COMPLETED",
                details=log_details,
            )

        # 4. Invalidate Redis Cache so fresh data shows immediately
        if saved_count > 0:
            await cache_service.delete_pattern("events:*")
            await cache_service.delete_pattern("stats:*")
            logger.info("Invalidated events and stats cache keys after new ingestion.")

        logger.info(f"Ingestion completed. Fetched: {fetched_count}, Saved/Updated: {saved_count}, AI processed: {ai_processed_count}")
        return {
            "status": "success",
            "fetched": fetched_count,
            "saved": saved_count,
            "ai_processed": ai_processed_count,
            "groq_active": self.groq_service.is_available,
        }

    async def start_periodic_ingest(self):
        """Background loop polling GDELT at intervals (only if explicitly enabled)."""
        if not settings.ENABLE_INTERNAL_SCHEDULER:
            logger.info("Internal scheduler is disabled (external cron / GitHub Actions configured).")
            return

        self._is_running = True
        logger.info(f"Background ingest loop active. Interval: {settings.INGEST_INTERVAL_MINUTES} minutes.")

        if settings.AUTO_INGEST_ON_STARTUP:
            try:
                await self.run_pipeline()
            except Exception:
                logger.exception("Error during startup ingestion")

        while self._is_running:
            try:
                await asyncio.sleep(settings.INGEST_INTERVAL_MINUTES * 60)
                if self._is_running:
                    await self.run_pipeline()
            except asyncio.CancelledError:
                logger.info("Background ingestion task received cancellation.")
                break
            except Exception:
                logger.exception("Error in periodic ingestion worker")
                await asyncio.sleep(30)

    def stop_periodic_ingest(self):
        self._is_running = False

ingestion_service = IngestionService()
