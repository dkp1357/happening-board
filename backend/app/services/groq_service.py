import asyncio
import json
import logging
import re
from typing import Any

from groq import APIError, AsyncGroq, RateLimitError

from app.config import settings
from app.models.common import EventCategory, SeverityLevel
from app.models.event import EventCreate

logger = logging.getLogger(__name__)

class GroqAIService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY.strip()
        self.client: AsyncGroq | None = None
        if self.api_key:
            self.client = AsyncGroq(api_key=self.api_key)
        self.model = settings.GROQ_MODEL
        # Enforce maximum batch size of 5 to protect Groq free tier 8K TPM limit
        self.batch_size = min(5, max(1, getattr(settings, "GROQ_BATCH_SIZE", 5)))
        # Pacing delay between batch API calls to stay under 8K TPM and 30 RPM
        self.pacing_delay = float(getattr(settings, "GROQ_PACING_DELAY_SECONDS", 4.0))

    @property
    def is_available(self) -> bool:
        return bool(self.client and self.api_key)

    async def enrich_events(self, events: list[EventCreate]) -> list[EventCreate]:
        """
        Enrich a batch of incoming events with AI summaries, categories, and severity.
        Designed for Groq Free Tier limits (TPM: 8K, RPM: 30, Daily: 200K tokens).
        Gracefully falls back to heuristic tagging if Groq is unavailable or rate-limited.
        """
        if not events:
            return []

        if not self.is_available or not settings.AI_ENRICHMENT_ENABLED:
            logger.info("Groq API key not set or AI disabled. Using heuristic enrichment.")
            return self._heuristic_enrich_batch(events)

        enriched: list[EventCreate] = []
        total_events = len(events)
        batch_size = self.batch_size

        logger.info(
            f"Starting Groq enrichment for {total_events} events "
            f"(model={self.model}, batch_size={batch_size}, pacing={self.pacing_delay}s)"
        )

        for i in range(0, total_events, batch_size):
            chunk = events[i : i + batch_size]
            chunk_num = (i // batch_size) + 1
            total_chunks = (total_events + batch_size - 1) // batch_size

            processed_chunk = await self._enrich_chunk_with_retry(chunk, chunk_num, total_chunks)
            enriched.extend(processed_chunk)

            # Pacing delay between chunks to respect rolling 8K TPM window
            if i + batch_size < total_events and self.pacing_delay > 0:
                logger.debug(f"Pacing Groq requests: sleeping {self.pacing_delay}s before next batch...")
                await asyncio.sleep(self.pacing_delay)

        return enriched

    async def _enrich_chunk_with_retry(
        self,
        chunk: list[EventCreate],
        chunk_num: int,
        total_chunks: int,
        max_retries: int = 2,
    ) -> list[EventCreate]:
        """Attempt chunk enrichment with backoff on rate limits."""
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Processing Groq chunk {chunk_num}/{total_chunks} ({len(chunk)} events, attempt {attempt + 1})...")
                return await self._process_chunk_with_groq(chunk)
            except RateLimitError as e:
                # Extract suggested retry delay from error message or header
                retry_wait = self._extract_retry_delay(e, default=5.0 * (attempt + 1))
                if attempt < max_retries and retry_wait <= 25.0:
                    logger.warning(
                        f"Groq Rate limit hit on chunk {chunk_num}/{total_chunks}. "
                        f"Backing off for {retry_wait:.1f}s before retry ({attempt + 1}/{max_retries})..."
                    )
                    await asyncio.sleep(retry_wait)
                else:
                    logger.warning(
                        f"Groq Rate limit exceeded (retries exhausted or wait too long: {retry_wait:.1f}s). "
                        f"Falling back to heuristics for chunk {chunk_num}."
                    )
                    return self._heuristic_enrich_batch(chunk)
            except APIError as e:
                logger.warning(f"Groq API error on chunk {chunk_num}: {e}. Falling back to heuristics.")
                return self._heuristic_enrich_batch(chunk)
            except Exception as e:
                logger.warning(f"Unexpected error during Groq enrichment on chunk {chunk_num}: {e}. Falling back to heuristics.")
                return self._heuristic_enrich_batch(chunk)

        return self._heuristic_enrich_batch(chunk)

    def _extract_retry_delay(self, exc: RateLimitError, default: float = 6.0) -> float:
        """Parse retry delay in seconds from RateLimitError message or response headers."""
        try:
            err_msg = str(exc)
            match = re.search(r"try again in ([0-9.]+)s", err_msg, re.IGNORECASE)
            if match:
                return float(match.group(1)) + 1.0  # Add 1s safety buffer

            match_ms = re.search(r"try again in ([0-9.]+)ms", err_msg, re.IGNORECASE)
            if match_ms:
                return (float(match_ms.group(1)) / 1000.0) + 1.0
        except Exception:
            pass
        return default

    async def _process_chunk_with_groq(self, chunk: list[EventCreate]) -> list[EventCreate]:
        """Send a chunk of events to Groq with structured JSON output."""
        items_payload = []
        for idx, ev in enumerate(chunk):
            # Trim payload to minimize token consumption against 8K TPM limit
            items_payload.append({
                "item_index": idx,
                "title": (ev.title or "")[:120],
                "domain": ev.source_domain or "news",
                "location": (ev.location_name or "Unknown")[:80],
                "country": ev.country_code or "Unknown",
                "actor1": (ev.actor1 or "")[:60],
                "actor2": (ev.actor2 or "")[:60],
                "goldstein": ev.goldstein_scale,
            })

        system_prompt = (
            "You are an expert OSINT and conflict-monitoring analyst for a dashboard like Liveuamap.\n"
            "Analyze each raw item and respond with valid JSON containing an 'enriched_events' array.\n"
            "For each item provide:\n"
            "- item_index: integer matching input\n"
            "- headline: Objective factual headline (max 10 words)\n"
            "- summary: Neutral 1-2 sentence briefing explaining what happened and strategic significance\n"
            "- category: EXACTLY one of: ['military_conflict', 'civil_unrest', 'terror_security', 'diplomacy', 'humanitarian', 'infrastructure_cyber', 'other']\n"
            "- severity: integer 1-5 (1=minor routine, 2=low/localized protest, 3=medium clash/border incident, 4=high/major military strike, 5=critical invasion/mass casualty)\n"
            "- key_actors: list of strings (countries, factions, leaders involved)\n"
            "Respond strictly in valid JSON."
        )

        user_content = json.dumps({"events": items_payload})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_completion_tokens=2048,  # Ample space for reasoning tokens + JSON response
        )

        content = response.choices[0].message.content
        data = json.loads(content)
        ai_items = data.get("enriched_events") or data.get("events") or []

        ai_by_index: dict[int, dict[str, Any]] = {
            item["item_index"]: item for item in ai_items if "item_index" in item
        }

        result: list[EventCreate] = []
        for idx, ev in enumerate(chunk):
            ai_data = ai_by_index.get(idx)
            if ai_data:
                category_str = ai_data.get("category", "other").lower()
                valid_cat = EventCategory.OTHER
                for cat in EventCategory:
                    if cat.value == category_str:
                        valid_cat = cat
                        break

                sev_val = ai_data.get("severity", 2)
                try:
                    valid_sev = SeverityLevel(int(sev_val))
                except Exception:
                    valid_sev = SeverityLevel.LOW

                actors = ai_data.get("key_actors", [])
                if not isinstance(actors, list):
                    actors = [str(actors)]

                ev.title = ai_data.get("headline", ev.title)
                ev.summary = ai_data.get("summary", ev.summary)
                ev.category = valid_cat
                ev.severity = valid_sev
                ev.key_actors = actors
                ev.ai_processed = True
            else:
                self._heuristic_enrich_single(ev)

            result.append(ev)

        return result

    def _heuristic_enrich_batch(self, events: list[EventCreate]) -> list[EventCreate]:
        for ev in events:
            self._heuristic_enrich_single(ev)
        return events

    def _heuristic_enrich_single(self, ev: EventCreate) -> None:
        """Fallback rule-based categorization & summarization when LLM is unavailable."""
        title_lower = (ev.title + " " + ev.source_url).lower()

        # Keyword based category mapping
        if any(w in title_lower for w in ["missile", "strike", "airstrike", "artillery", "offensive", "forces", "army", "war", "troops"]):
            ev.category = EventCategory.MILITARY_CONFLICT
            ev.severity = SeverityLevel.HIGH
        elif any(w in title_lower for w in ["protest", "riot", "clash", "rally", "demonstration", "tear gas", "unrest"]):
            ev.category = EventCategory.CIVIL_UNREST
            ev.severity = SeverityLevel.MEDIUM
        elif any(w in title_lower for w in ["terror", "bomb", "explosion", "ied", "militant", "ambush", "gunman"]):
            ev.category = EventCategory.TERROR_SECURITY
            ev.severity = SeverityLevel.HIGH
        elif any(w in title_lower for w in ["cyber", "blackout", "grid", "pipeline", "dam", "port"]):
            ev.category = EventCategory.INFRASTRUCTURE_CYBER
            ev.severity = SeverityLevel.MEDIUM
        elif any(w in title_lower for w in ["aid", "refugee", "evacuat", "casualt", "red cross", "unicef"]):
            ev.category = EventCategory.HUMANITARIAN
            ev.severity = SeverityLevel.LOW
        elif any(w in title_lower for w in ["summit", "treaty", "talks", "ceasefire", "diplomat", "sanction"]):
            ev.category = EventCategory.DIPLOMACY
            ev.severity = SeverityLevel.INFO

        # Goldstein scale adjustment
        if ev.goldstein_scale is not None:
            if ev.goldstein_scale <= -7.0:
                ev.severity = SeverityLevel.CRITICAL
            elif ev.goldstein_scale <= -4.0:
                ev.severity = max(ev.severity, SeverityLevel.HIGH)

        # Assemble summary if missing
        if not ev.summary or ev.summary == ev.title:
            actors_str = ""
            if ev.actor1 and ev.actor2:
                actors_str = f"between {ev.actor1} and {ev.actor2} "
            elif ev.actor1:
                actors_str = f"involving {ev.actor1} "

            loc_str = f"in {ev.location_name}" if ev.location_name else ""
            cat_desc = ev.category.value.replace("_", " ").title()
            ev.summary = f"Reported {cat_desc} incident {actors_str}{loc_str}."

        actors = []
        if ev.actor1:
            actors.append(ev.actor1)
        if ev.actor2:
            actors.append(ev.actor2)
        ev.key_actors = actors
        ev.ai_processed = False
