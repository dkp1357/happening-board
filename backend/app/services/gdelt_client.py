import csv
import io
import logging
import re
import urllib.parse
import zipfile
from datetime import UTC, datetime

import httpx

from app.config import settings
from app.models.common import (
    cameo_to_category_and_severity,
)
from app.models.event import EventCreate

logger = logging.getLogger(__name__)

class GDELTClient:
    def __init__(self):
        self.last_update_url = settings.GDELT_LAST_UPDATE_URL
        self.doc_api_url = settings.GDELT_DOC_API_URL

    async def fetch_latest_events(self, max_records: int = 50) -> list[EventCreate]:
        """
        Fetch real-time events from GDELT 2.0 15-minute export feed.
        Downloads the current export zip, parses the tab-separated records,
        and filters for conflict/security/crisis events with valid coordinates.
        """
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                logger.info(f"Checking GDELT lastupdate at {self.last_update_url}")
                resp = await client.get(self.last_update_url)
                resp.raise_for_status()
                text = resp.text.strip()
            except Exception as e:
                logger.error(f"Failed to fetch GDELT lastupdate.txt: {e}")
                return []

            # Format of lastupdate.txt:
            # <size> <hash> http://data.gdeltproject.org/gdeltv2/<timestamp>.export.CSV.zip
            export_url = None
            for line in text.splitlines():
                parts = line.split()
                if len(parts) >= 3 and parts[2].endswith(".export.CSV.zip"):
                    export_url = parts[2]
                    break

            if not export_url:
                logger.error("Could not find export.CSV.zip URL in GDELT lastupdate response")
                return []

            logger.info(f"Downloading latest GDELT export feed: {export_url}")
            try:
                zip_resp = await client.get(export_url)
                zip_resp.raise_for_status()
            except Exception as e:
                logger.error(f"Failed to download GDELT export zip: {e}")
                return []

        try:
            with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as zf:
                csv_files = [n for n in zf.namelist() if n.endswith((".CSV", ".csv"))]
                if not csv_files:
                    logger.error("No CSV found in GDELT zip archive")
                    return []
                
                with zf.open(csv_files[0]) as f:
                    content_str = io.TextIOWrapper(f, encoding="utf-8", errors="replace")
                    reader = csv.reader(content_str, delimiter="\t")
                    events = self._parse_export_csv(reader, max_records=max_records)
                    logger.info(f"Successfully extracted {len(events)} conflict/monitoring events from GDELT")
                    return events
        except Exception as e:
            logger.error(f"Failed to parse GDELT zip/CSV content: {e}")
            return []

    def _parse_export_csv(self, reader, max_records: int) -> list[EventCreate]:
        """
        Parses GDELT 2.0 Event CSV format:
        Col 0: GlobalEventID
        Col 1: Day (YYYYMMDD)
        Col 6: Actor1Name
        Col 16: Actor2Name
        Col 26: EventCode (CAMEO)
        Col 29: QuadClass (1: Verbal Coop, 2: Material Coop, 3: Verbal Conflict, 4: Material Conflict)
        Col 30: GoldsteinScale (-10 to +10)
        Col 34: AvgTone (-100 to +100)
        Col 52: ActionGeo_FullName
        Col 53: ActionGeo_CountryCode
        Col 56: ActionGeo_Lat
        Col 57: ActionGeo_Long
        Col 60: SOURCEURL
        """
        events: list[EventCreate] = []
        seen_urls = set()

        for row in reader:
            if len(row) < 61:
                continue

            # Geolocation check
            lat_str = row[56].strip()
            lon_str = row[57].strip()
            if not lat_str or not lon_str:
                continue

            try:
                lat = float(lat_str)
                lon = float(lon_str)
                if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                    continue
                # Skip (0, 0) default coordinates
                if abs(lat) < 0.001 and abs(lon) < 0.001:
                    continue
            except ValueError:
                continue

            source_url = row[60].strip()
            if not source_url or source_url in seen_urls:
                continue

            cameo_code = row[26].strip()
            try:
                quad_class = int(row[29].strip()) if row[29].strip() else 0
            except ValueError:
                quad_class = 0

            # Filter for conflict, protests, military, or security events
            is_conflict = quad_class in (3, 4) or cameo_code.startswith(("14", "15", "16", "17", "18", "19", "20"))
            if not is_conflict:
                continue

            seen_urls.add(source_url)

            # Metadata extraction
            global_event_id = row[0].strip()
            actor1 = row[6].strip() or None
            actor2 = row[16].strip() or None
            location_name = row[52].strip() or None
            country_code = row[53].strip() or None

            try:
                goldstein = float(row[30].strip()) if row[30].strip() else None
            except ValueError:
                goldstein = None

            try:
                avg_tone = float(row[34].strip()) if row[34].strip() else None
            except ValueError:
                avg_tone = None

            # Extract title candidate from URL or synthesize
            domain = self._extract_domain(source_url)
            title = self._title_from_url_or_event(source_url, cameo_code, actor1, actor2, location_name)

            category, severity = cameo_to_category_and_severity(cameo_code, quad_class)

            # Build preliminary event timestamp from GDELT Day (YYYYMMDD) or now
            day_str = row[1].strip()
            event_ts = self._parse_gdelt_date(day_str)

            event = EventCreate(
                global_event_id=global_event_id,
                title=title,
                summary=f"Event in {location_name or 'region'} reported via {domain}.",
                category=category,
                severity=severity,
                latitude=lat,
                longitude=lon,
                location_name=location_name,
                country_code=country_code,
                source_url=source_url,
                source_domain=domain,
                actor1=actor1,
                actor2=actor2,
                key_actors=[a for a in [actor1, actor2] if a],
                goldstein_scale=goldstein,
                avg_tone=avg_tone,
                event_timestamp=event_ts,
                ai_processed=False,
            )
            events.append(event)

            if len(events) >= max_records:
                break

        return events

    def _extract_domain(self, url: str) -> str:
        try:
            parsed = urllib.parse.urlparse(url)
            return parsed.netloc.replace("www.", "")
        except Exception:
            return "news"

    def _title_from_url_or_event(
        self,
        url: str,
        cameo: str,
        actor1: str | None,
        actor2: str | None,
        location: str | None
    ) -> str:
        # Try extracting readable slug from URL path
        try:
            path = urllib.parse.urlparse(url).path
            slug = path.rstrip("/").split("/")[-1]
            slug = re.sub(r"\.(html|php|aspx|htm)$", "", slug)
            # Replace hyphens/underscores with spaces
            clean_slug = re.sub(r"[-_]+", " ", slug).strip()
            if len(clean_slug) > 15 and not clean_slug.isdigit():
                return clean_slug[:120].capitalize()
        except Exception:
            pass

        # Synthesize fallback
        actors = []
        if actor1:
            actors.append(actor1)
        if actor2:
            actors.append(actor2)
        actors_str = f" ({' vs '.join(actors)})" if actors else ""
        loc_str = f" in {location}" if location else ""

        category, _ = cameo_to_category_and_severity(cameo)
        cat_name = category.value.replace("_", " ").title()
        return f"{cat_name} Activity Reported{loc_str}{actors_str}"

    def _parse_gdelt_date(self, day_str: str) -> str:
        try:
            if len(day_str) == 8:
                dt = datetime.strptime(day_str, "%Y%m%d").replace(tzinfo=UTC)
                return dt.isoformat()
        except Exception:
            pass
        return datetime.now(UTC).isoformat()
