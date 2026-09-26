import json
import logging
from typing import Any

from groq import AsyncGroq

from app.config import settings
from app.models.common import (
    EventCategory,
    SeverityLevel,
)
from app.models.event import EventCreate

logger = logging.getLogger(__name__)

class GroqAIService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY.strip()
        self.client: AsyncGroq | None = None
        if self.api_key:
            self.client = AsyncGroq(api_key=self.api_key)
        self.model = settings.GROQ_MODEL

    @property
    def is_available(self) -> bool:
        return bool(self.client and self.api_key)

    async def enrich_events(self, events: list[EventCreate]) -> list[EventCreate]:
        """
        Enrich a batch of incoming events with AI summaries, categories, and severity.
        Gracefully falls back to heuristic tagging if Groq is unavailable or rate-limited.
        """
        if not events:
            return []

        if not self.is_available or not settings.AI_ENRICHMENT_ENABLED:
            logger.info("Groq API key not set or AI disabled. Using heuristic enrichment.")
            return self._heuristic_enrich_batch(events)

        enriched: list[EventCreate] = []
        batch_size = max(1, settings.GROQ_BATCH_SIZE)

        for i in range(0, len(events), batch_size):
            chunk = events[i : i + batch_size]
            try:
                processed_chunk = await self._process_chunk_with_groq(chunk)
                enriched.extend(processed_chunk)
            except Exception as e:
                logger.warning(f"Groq API error during batch enrichment: {e}. Falling back to heuristics.")
                enriched.extend(self._heuristic_enrich_batch(chunk))

        return enriched

    async def _process_chunk_with_groq(self, chunk: list[EventCreate]) -> list[EventCreate]:
        """Send a chunk of events to Groq with structured JSON output."""
        items_payload = []
        for idx, ev in enumerate(chunk):
            items_payload.append({
                "item_index": idx,
                "title": ev.title,
                "source_url": ev.source_url,
                "location": ev.location_name or "Unknown location",
                "country": ev.country_code or "Unknown",
                "actor1": ev.actor1,
                "actor2": ev.actor2,
                "goldstein_scale": ev.goldstein_scale,
                "avg_tone": ev.avg_tone,
            })

        system_prompt = (
            "You are an expert real-time OSINT (Open Source Intelligence) and conflict-monitoring analyst for a dashboard like Liveuamap.\n"
            "Given a list of raw incoming news events, analyze each item and return a structured JSON object containing an 'enriched_events' array.\n"
            "For each item, produce:\n"
            "- item_index: integer corresponding to the input\n"
            "- headline: A punchy, factual, objective headline (max 12 words)\n"
            "- summary: A neutral, verified 1-2 sentence briefing explaining what happened and strategic significance\n"
            "- category: EXACTLY one of: ['military_conflict', 'civil_unrest', 'terror_security', 'diplomacy', 'humanitarian', 'infrastructure_cyber', 'other']\n"
            "- severity: integer from 1 to 5 (1=minor routine, 2=low/localized protest, 3=medium clash/border incident, 4=high/major military strike, 5=critical invasion/mass casualty)\n"
            "- key_actors: list of strings (countries, factions, leaders, or militant groups involved)\n"
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
            max_completion_tokens=1500,
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
