import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import asyncpg

from app.config import settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None

async def init_db_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        db_url = settings.get_database_url
        logger.info("Connecting to PostgreSQL database...")
        _pool = await asyncpg.create_pool(
            dsn=db_url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        logger.info("PostgreSQL connection pool established.")
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")
        

@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection]:
    global _pool
    if _pool is not None:
        await init_db_pool()
    async with _pool.acquire() as conn:
        yield conn
        

async def get_db() -> AsyncGenerator[asyncpg.Connection]:
    async with get_db_connection() as conn:
        yield conn