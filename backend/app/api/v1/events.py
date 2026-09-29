import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import get_db_session
from app.db import repository
from app.models.common import EventCategory
from app.models.event import (
    EventListResponse,
    EventResponse,
    GeoJSONFeature,
    GeoJSONFeatureCollection,
    GeoJSONGeometry,
    GeoJSONProperties,
)
from app.rate_limiter import limiter
from app.services.cache_service import cache_service

router = APIRouter(prefix="/events", tags=["Events"])

@router.get("", response_model=EventListResponse, responses= {429: {
            "description": "Rate Limit Exceeded",
        }})
@limiter.limit("60/minute")
async def list_events(
    request: Request,
    category: EventCategory | None = Query(None, description="Filter by event category"),
    min_severity: int | None = Query(None, ge=1, le=5, description="Filter by minimum severity (1-5)"),
    country_code: str | None = Query(None, description="2-letter country code filter (e.g. UA, SY, IL)"),
    search: str | None = Query(None, description="Keyword search across title, summary, location"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    conn: asyncpg.Connection = Depends(get_db_session),
):
    """
    List events with filtering, pagination, and keyword search. Cached via Redis (TTL: 60s).
    """
    cat_val = category.value if category else ""
    cache_key = f"events:list:{cat_val}:{min_severity}:{country_code}:{search}:{limit}:{offset}"
    cached_data = await cache_service.get_json(cache_key)
    if cached_data is not None:
        return EventListResponse(**cached_data)

    events, total = await repository.get_events(
        conn,
        category=category.value if category else None,
        min_severity=min_severity,
        country_code=country_code,
        search=search,
        limit=limit,
        offset=offset,
    )
    result = EventListResponse(total=total, limit=limit, offset=offset, events=events)
    await cache_service.set_json(cache_key, result.model_dump(), ttl_seconds=60)
    return result

@router.get("/geojson", response_model=GeoJSONFeatureCollection, responses= {429: {
            "description": "Rate Limit Exceeded",
        }})
@limiter.limit("60/minute")
async def get_events_geojson(
    request: Request,
    category: EventCategory | None = Query(None, description="Filter by event category"),
    min_severity: int | None = Query(None, ge=1, le=5, description="Filter by minimum severity (1-5)"),
    country_code: str | None = Query(None, description="2-letter country code filter"),
    limit: int = Query(100, ge=1, le=500, description="Max features to return for map overlay"),
    conn: asyncpg.Connection = Depends(get_db_session),
):
    """
    Returns events in GeoJSON format (RFC 7946) for MapLibre, Leaflet, or Mapbox.
    Cached via Redis (TTL: 120s).
    """
    cat_val = category.value if category else ""
    cache_key = f"events:geojson:{cat_val}:{min_severity}:{country_code}:{limit}"
    cached_data = await cache_service.get_json(cache_key)
    if cached_data is not None:
        return GeoJSONFeatureCollection(**cached_data)

    events, _ = await repository.get_events(
        conn,
        category=category.value if category else None,
        min_severity=min_severity,
        country_code=country_code,
        limit=limit,
        offset=0,
    )

    features: list[GeoJSONFeature] = []
    for ev in events:
        feature = GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Point",
                coordinates=[ev.longitude, ev.latitude],
            ),
            properties=GeoJSONProperties(
                id=ev.id,
                title=ev.title,
                summary=ev.summary,
                category=ev.category.value,
                severity=int(ev.severity),
                location_name=ev.location_name,
                country_code=ev.country_code,
                source_url=ev.source_url,
                source_domain=ev.source_domain,
                key_actors=ev.key_actors,
                event_timestamp=ev.event_timestamp,
                ai_processed=ev.ai_processed,
            ),
        )
        features.append(feature)

    collection = GeoJSONFeatureCollection(type="FeatureCollection", features=features)
    await cache_service.set_json(cache_key, collection.model_dump(), ttl_seconds=120)
    return collection

@router.get("/bbox", response_model=list[EventResponse], responses= {429: {
            "description": "Rate Limit Exceeded",
        }})
@limiter.limit("60/minute")
async def get_events_by_bounding_box(
    request: Request,
    min_lat: float = Query(..., ge=-90.0, le=90.0, description="Southernmost latitude"),
    min_lon: float = Query(..., ge=-180.0, le=180.0, description="Westernmost longitude"),
    max_lat: float = Query(..., ge=-90.0, le=90.0, description="Northernmost latitude"),
    max_lon: float = Query(..., ge=-180.0, le=180.0, description="Easternmost longitude"),
    category: EventCategory | None = Query(None, description="Filter by category"),
    min_severity: int | None = Query(None, ge=1, le=5, description="Filter by minimum severity"),
    limit: int = Query(100, ge=1, le=300, description="Max results"),
    conn: asyncpg.Connection = Depends(get_db_session),
):
    """
    Spatial query for events within a viewport bounding box. Cached via Redis (TTL: 60s).
    """
    cat_val = category.value if category else ""
    cache_key = f"events:bbox:{min_lat}:{min_lon}:{max_lat}:{max_lon}:{cat_val}:{min_severity}:{limit}"
    cached_data = await cache_service.get_json(cache_key)
    if cached_data is not None:
        return [EventResponse(**item) for item in cached_data]

    events = await repository.get_events_in_bbox(
        conn,
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        category=category.value if category else None,
        min_severity=min_severity,
        limit=limit,
    )
    await cache_service.set_json(cache_key, [e.model_dump() for e in events], ttl_seconds=60)
    return events

@router.get("/{event_id}", response_model=EventResponse, responses= {429: {
            "description": "Rate Limit Exceeded",
        }})
@limiter.limit("60/minute")
async def get_event_detail(
    request: Request,
    event_id: str,
    conn: asyncpg.Connection = Depends(get_db_session),
):
    """
    Fetch a single event's detailed information by ID. Cached via Redis (TTL: 300s).
    """
    cache_key = f"events:detail:{event_id}"
    cached_data = await cache_service.get_json(cache_key)
    if cached_data is not None:
        return EventResponse(**cached_data)

    event = await repository.get_event_by_id(conn, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id '{event_id}' was not found.",
        )
    await cache_service.set_json(cache_key, event.model_dump(), ttl_seconds=300)
    return event
