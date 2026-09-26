from collections.abc import AsyncGenerator

import asyncpg
from fastapi import Header, HTTPException, status

from app.config import settings
from app.db.session import get_db_connection


async def get_db_session() -> AsyncGenerator[asyncpg.Connection]:
    async with get_db_connection() as conn:
        yield conn
        
async def verify_ingest_key(
    x_api_key: str | None = Header(None, alias="X-API-Key", description="secret ingest api key")
) -> str:
    """
    Lock down ingestion endpoints to prevent unauthorized or abusive triggers.
    Requires header: 'X-API-Key: <INGEST_API_KEY>'
    """
    expected_key = settings.INGEST_API_KEY.strip()
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INGEST_API_KEY is not configured on the server."
        )

    if not x_api_key or x_api_key.strip() != expected_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid or missing X-API-Key header."
        )
    return x_api_key