import json
import uuid
from datetime import UTC, datetime
from typing import Any

import asyncpg

from app.models.common import EventCategory, SeverityLevel
from app.models.event import (
    CategoryStat,
    CountryStat,
    DashboardStats,
    EventCreate,
    EventResponse,
    SeverityStat,
)


async def init_db(conn: asyncpg.Connection) -> None:
    """Initialize PostgreSQL tables and indexes."""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            global_event_id TEXT UNIQUE,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            category VARCHAR(64) NOT NULL,
            severity SMALLINT NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            location_name TEXT,
            country_code VARCHAR(10),
            source_url TEXT NOT NULL UNIQUE,
            source_domain TEXT,
            actor1 TEXT,
            actor2 TEXT,
            key_actors JSONB DEFAULT '[]'::jsonb,
            goldstein_scale REAL,
            avg_tone REAL,
            ai_processed BOOLEAN DEFAULT FALSE,
            event_timestamp TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ingest_logs (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMPTZ NOT NULL,
            events_fetched INT NOT NULL,
            events_saved INT NOT NULL,
            ai_processed INT NOT NULL,
            status VARCHAR(64) NOT NULL,
            details TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_events_geo ON events(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_events_cat ON events(category);
        CREATE INDEX IF NOT EXISTS idx_events_sev ON events(severity);
        CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_events_country ON events(country_code);
    """)
    

def _record_to_event(row: asyncpg.Record) -> EventResponse:
    raw_actors = row["key_actors"]
    if isinstance(raw_actors, list):
        key_actors = raw_actors
    elif isinstance(raw_actors, str):
        try:
            key_actors = json.loads(raw_actors)
        except Exception:
            key_actors = []
    else:
        key_actors = []

    # Handle datetime formatting
    ts = row["event_timestamp"]
    ts_str = ts.isoformat() if isinstance(ts, datetime) else str(ts)
    ca = row["created_at"]
    ca_str = ca.isoformat() if isinstance(ca, datetime) else str(ca)

    return EventResponse(
        id=row["id"],
        global_event_id=row["global_event_id"],
        title=row["title"],
        summary=row["summary"],
        category=EventCategory(row["category"]),
        severity=SeverityLevel(row["severity"]),
        latitude=row["latitude"],
        longitude=row["longitude"],
        location_name=row["location_name"],
        country_code=row["country_code"],
        source_url=row["source_url"],
        source_domain=row["source_domain"],
        actor1=row["actor1"],
        actor2=row["actor2"],
        key_actors=key_actors,
        goldstein_scale=row["goldstein_scale"],
        avg_tone=row["avg_tone"],
        ai_processed=bool(row["ai_processed"]),
        event_timestamp=ts_str,
        created_at=ca_str,
    )
    

def _parse_ts(val: str) -> datetime:
    try:
        return datetime.fromisoformat(val)
    except Exception:
        return datetime.now(UTC)
    

async def insert_events(conn: asyncpg.Connection, events: list[EventCreate]) -> int:
    """Insert events into PostgreSQL with deduplication on source_url."""
    if not events:
        return 0

    inserted = 0
    now = datetime.now(UTC)

    query = """
        INSERT INTO events (
            id, global_event_id, title, summary, category, severity,
            latitude, longitude, location_name, country_code,
            source_url, source_domain, actor1, actor2, key_actors,
            goldstein_scale, avg_tone, ai_processed, event_timestamp, created_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14, $15::jsonb,
            $16, $17, $18, $19, $20
        )
        ON CONFLICT (source_url) DO UPDATE SET
            ai_processed = EXCLUDED.ai_processed,
            summary = CASE WHEN EXCLUDED.ai_processed = TRUE THEN EXCLUDED.summary ELSE events.summary END,
            title = CASE WHEN EXCLUDED.ai_processed = TRUE THEN EXCLUDED.title ELSE events.title END,
            category = CASE WHEN EXCLUDED.ai_processed = TRUE THEN EXCLUDED.category ELSE events.category END,
            severity = CASE WHEN EXCLUDED.ai_processed = TRUE THEN EXCLUDED.severity ELSE events.severity END,
            key_actors = CASE WHEN EXCLUDED.ai_processed = TRUE THEN EXCLUDED.key_actors ELSE events.key_actors END
    """

    for ev in events:
        event_id = str(uuid.uuid4())
        key_actors_json = json.dumps(ev.key_actors)
        event_ts = _parse_ts(ev.event_timestamp)

        status_result = await conn.execute(
            query,
            event_id,
            ev.global_event_id,
            ev.title,
            ev.summary,
            ev.category.value if isinstance(ev.category, EventCategory) else ev.category,
            int(ev.severity),
            ev.latitude,
            ev.longitude,
            ev.location_name,
            ev.country_code,
            ev.source_url,
            ev.source_domain,
            ev.actor1,
            ev.actor2,
            key_actors_json,
            ev.goldstein_scale,
            ev.avg_tone,
            ev.ai_processed,
            event_ts,
            now,
        )
        if "INSERT 0 1" in status_result:
            inserted += 1

    return inserted


async def get_events(
    conn: asyncpg.Connection,
    category: str | None = None,
    min_severity: int | None = None,
    country_code: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[EventResponse], int]:
    """Fetch paginated events with PostgreSQL filters and ILIKE search."""
    where_clauses = ["1=1"]
    params: list[Any] = []
    param_idx = 1

    if category:
        where_clauses.append(f"category = ${param_idx}")
        params.append(category)
        param_idx += 1

    if min_severity is not None:
        where_clauses.append(f"severity >= ${param_idx}")
        params.append(min_severity)
        param_idx += 1

    if country_code:
        where_clauses.append(f"UPPER(country_code) = UPPER(${param_idx})")
        params.append(country_code)
        param_idx += 1

    if search:
        search_pattern = f"%{search}%"
        where_clauses.append(f"(title ILIKE ${param_idx} OR summary ILIKE ${param_idx} OR location_name ILIKE ${param_idx})")
        params.append(search_pattern)
        param_idx += 1

    where_sql = " AND ".join(where_clauses)

    count_row = await conn.fetchrow(f"SELECT COUNT(*) FROM events WHERE {where_sql}", *params)
    total = count_row[0] if count_row else 0

    limit_idx = param_idx
    offset_idx = param_idx + 1
    query_sql = f"""
        SELECT * FROM events
        WHERE {where_sql}
        ORDER BY event_timestamp DESC
        LIMIT ${limit_idx} OFFSET ${offset_idx}
    """
    rows = await conn.fetch(query_sql, *params, limit, offset)
    events = [_record_to_event(r) for r in rows]
    return events, total


async def get_events_in_bbox(
    conn: asyncpg.Connection,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    category: str | None = None,
    min_severity: int | None = None,
    limit: int = 150,
) -> list[EventResponse]:
    """Retrieve events within a bounding box for map viewport queries."""
    where_clauses = [
        "latitude BETWEEN $1 AND $2",
        "longitude BETWEEN $3 AND $4"
    ]
    params: list[Any] = [min_lat, max_lat, min_lon, max_lon]
    param_idx = 5

    if category:
        where_clauses.append(f"category = ${param_idx}")
        params.append(category)
        param_idx += 1

    if min_severity is not None:
        where_clauses.append(f"severity >= ${param_idx}")
        params.append(min_severity)
        param_idx += 1

    where_sql = " AND ".join(where_clauses)
    query_sql = f"""
        SELECT * FROM events
        WHERE {where_sql}
        ORDER BY severity DESC, event_timestamp DESC
        LIMIT ${param_idx}
    """
    params.append(limit)

    rows = await conn.fetch(query_sql, *params)
    return [_record_to_event(r) for r in rows]


async def get_event_by_id(conn: asyncpg.Connection, event_id: str) -> EventResponse | None:
    row = await conn.fetchrow("SELECT * FROM events WHERE id = $1", event_id)
    return _record_to_event(row) if row else None



async def get_dashboard_stats(conn: asyncpg.Connection) -> DashboardStats:
    """Aggregate statistics for live dashboards in PostgreSQL."""
    total_row = await conn.fetchrow("SELECT COUNT(*), COUNT(*) FILTER (WHERE ai_processed = TRUE) FROM events")
    total = total_row[0] if total_row else 0
    ai_total = total_row[1] if total_row else 0

    cat_rows = await conn.fetch("""
        SELECT category, COUNT(*) as cnt
        FROM events
        GROUP BY category
        ORDER BY cnt DESC
    """)
    categories = [CategoryStat(category=r["category"], count=r["cnt"]) for r in cat_rows]

    sev_rows = await conn.fetch("""
        SELECT severity, COUNT(*) as cnt
        FROM events
        GROUP BY severity
        ORDER BY severity ASC
    """)
    severity_distribution = [SeverityStat(severity=r["severity"], count=r["cnt"]) for r in sev_rows]

    country_rows = await conn.fetch("""
        SELECT country_code, COUNT(*) as cnt
        FROM events
        WHERE country_code IS NOT NULL AND country_code != ''
        GROUP BY country_code
        ORDER BY cnt DESC
        LIMIT 10
    """)
    top_hotspots = [CountryStat(country_code=r["country_code"], count=r["cnt"]) for r in country_rows]

    latest_row = await conn.fetchrow("SELECT MAX(event_timestamp) FROM events")
    latest_time = None
    if latest_row and latest_row[0]:
        t = latest_row[0]
        latest_time = t.isoformat() if isinstance(t, datetime) else str(t)

    return DashboardStats(
        total_events=total,
        ai_processed_events=ai_total,
        categories=categories,
        severity_distribution=severity_distribution,
        top_hotspots=top_hotspots,
        latest_event_time=latest_time,
    )


async def record_ingest_log(
    conn: asyncpg.Connection,
    fetched: int,
    saved: int,
    ai_count: int,
    status: str,
    details: str = "",
) -> None:
    now = datetime.now(UTC)
    await conn.execute("""
        INSERT INTO ingest_logs (id, timestamp, events_fetched, events_saved, ai_processed, status, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, str(uuid.uuid4()), now, fetched, saved, ai_count, status, details)


async def get_latest_ingest_log(conn: asyncpg.Connection) -> dict | None:
    row = await conn.fetchrow("""
        SELECT * FROM ingest_logs ORDER BY timestamp DESC LIMIT 1
    """)
    if not row:
        return None
    d = dict(row)
    if isinstance(d.get("timestamp"), datetime):
        d["timestamp"] = d["timestamp"].isoformat()
    return d
