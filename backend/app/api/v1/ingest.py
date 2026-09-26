import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.api.deps import get_db_session, verify_ingest_key
from app.db import repository
from app.services.ingestion_service import ingestion_service

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/trigger", dependencies=[Depends(verify_ingest_key)])
async def trigger_ingestion(
    background_tasks: BackgroundTasks,
    max_records: int = Query(50, ge=1, le=200, description="Max records to fetch and enrich in this run"),
):
    """
    Manually trigger an asynchronous GDELT fetch + Groq AI enrichment pipeline run.
    Secured: Requires 'X-API-Key' header matching server INGEST_API_KEY.
    """
    background_tasks.add_task(ingestion_service.run_pipeline, max_records)
    return {
        "status": "triggered",
        "message": f"Ingestion pipeline started in background (limit: {max_records} records).",
    }
    
@router.get("/status")
async def get_ingest_status(conn: asyncpg.Connection = Depends(get_db_session)):
    """
    Get the status of the most recent GDELT ingestion cycle.
    """
    last_log = await repository.get_latest_ingest_log(conn)
    return {
        "last_cycle": last_log,
        "is_periodic_worker_active": ingestion_service._is_running,
        "groq_ai_active": ingestion_service.groq_service.is_available,
    }