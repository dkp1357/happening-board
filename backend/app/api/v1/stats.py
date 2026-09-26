import asyncpg
from fastapi import APIRouter, Depends

from app.api.deps import get_db_session
from app.db import repository
from app.models.event import DashboardStats
from app.services.cache_service import cache_service

router = APIRouter(prefix="/stats", tags=["Analytics"])

@router.get("", response_model=DashboardStats)
async def get_stats(conn: asyncpg.Connection = Depends(get_db_session)):
    """
    Returns aggregated OSINT metrics:
    - Total event volume
    - AI-processed vs raw ratio
    - Category distribution (Military, Civil Unrest, Terror, etc.)
    - Severity distribution (Levels 1 to 5)
    - Top active geographical hotspots

    Cached in Redis (TTL: 300s).
    """
    cache_key = "stats:dashboard"
    cached = await cache_service.get_json(cache_key)
    if cached is not None:
        return DashboardStats(**cached)
    
    stats = await repository.get_dashboard_stats(conn)
    await cache_service.set_json(cache_key, stats.model_dump(), ttl_seconds=300)
    return stats