import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.events import router as events_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.stats import router as stats_router
from app.config import settings
from app.db.repository import init_db
from app.db.session import close_db_pool, get_db_connection, init_db_pool
from app.services.cache_service import cache_service
from app.services.ingestion_service import ingestion_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("happening-board")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize PostgreSQL Connection Pool & Schema
    logger.info("Initializing PostgreSQL database pool...")
    try:
        await init_db_pool()
        async with get_db_connection() as conn:
            await init_db(conn)
        logger.info("PostgreSQL schema verified and ready.")
    except Exception as e:
        logger.exception(f"Database connection initialization warning: {e}. Ensure PostgreSQL is reachable.")

    # 2. Initialize Redis Cache Client
    await cache_service.init_client()

    # 3. Optional in-process scheduler (if enabled)
    bg_task = None
    if settings.ENABLE_INTERNAL_SCHEDULER:
        logger.info("Internal scheduler enabled. Starting periodic ingestion loop.")
        bg_task = asyncio.create_task(ingestion_service.start_periodic_ingest())
    else:
        logger.info("Internal scheduler disabled. Ingestion runs via external cron (e.g. GitHub Actions).")
        
    yield
    
    # Shutdown sequence
    logger.info("Shutting down application resources...")
    if bg_task:
        ingestion_service.stop_periodic_ingest()
        bg_task.cancel()
        try:
            await bg_task
        except asyncio.CancelledError:
            pass

    await cache_service.close()
    await close_db_pool()
    logger.info("Application shutdown complete.")


app = FastAPI(
    title="happening-board API",
    description="Real-time OSINT & Global Conflict Monitoring Backend (GDELT 2.0).",
    version="0.2.0",
    lifespan=lifespan,
)

limiter = Limiter(
    key_func=get_remote_address, 
    storage_uri=settings.get_redis_url,
    strategy="moving-window" # sliding-window
    )
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_headers_list,
    allow_credentials=True,
    allow_methods=settings.cors_methods_list,
    allow_headers=settings.cors_headers_list,
)

# Register API v1 Routers
app.include_router(events_router, prefix=settings.API_V1_PREFIX)
app.include_router(stats_router, prefix=settings.API_V1_PREFIX)
app.include_router(ingest_router, prefix=settings.API_V1_PREFIX)

@app.get("/", tags=["Root"])
async def root(request: Request):
    return {
        "project": "happening-board",
        "description": "Real-time OSINT & Conflict-Monitoring API using GDLET",
        "docs_url": "/docs",
        "endpoints": {
            "events": f"{settings.API_V1_PREFIX}/events",
            "geojson": f"{settings.API_V1_PREFIX}/events/geojson",
            "bbox": f"{settings.API_V1_PREFIX}/events/bbox",
            "stats": f"{settings.API_V1_PREFIX}/stats",
            "ingest_trigger": f"{settings.API_V1_PREFIX}/ingest/trigger (Requires X-API-Key)",
            "ingest_status": f"{settings.API_V1_PREFIX}/ingest/status",
        },
        "database": "postgresql",
        "cache": "redis",
        "scheduler": "github-actions-cron" if not settings.ENABLE_INTERNAL_SCHEDULER else "internal-asyncio",
        "ai_status": "enabled (Groq)" if ingestion_service.groq_service.is_available else "heuristic_fallback",
    }

@app.get("/health", tags=["Root"])
async def health_check(request: Request):
    redis_healthy = await cache_service.is_healthy()
    return {
        "status": "healthy",
        "database": "postgresql",
        "redis_connected": redis_healthy,
        "groq_configured": ingestion_service.groq_service.is_available,
        "scheduler_mode": "external_cron" if not settings.ENABLE_INTERNAL_SCHEDULER else "internal",
    }


