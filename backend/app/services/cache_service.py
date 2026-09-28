import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self._redis: aioredis.Redis | None = None
        self.enabled = settings.CACHE_ENABLED
        
    async def init_client(self):
        if not self.enabled:
            return
        try:
            self._redis = aioredis.from_url(
                settings.get_redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0
            )
            await self._redis.ping()
            logger.info("connected to redis cache successfully.")
        except Exception as e:
            logger.warning(f"redis cache connection failed: {e}. Falling back to direct database reads.")
            self._redis = None
            
    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()
            self._redis = None
            
    async def get(self, key: str) -> Any | None:
        if not self._redis or not self.enabled:
            return None
        try:
            await self._redis.get(key)
        except Exception as e:
            logger.warning(f"Cache get error for key '{key}': {e}")
            return None
        
    async def get_json(self, key: str) -> Any | None:
        raw = await self.get(key)
        if raw is not None:
            try:
                return json.loads(raw)
            except Exception:
                return None
        return None
    
    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> bool:
        if not self._redis or not self.enabled:
            return False
        try:
            ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_DEFAULT_TTL
            await self._redis.set(key, value, ex=ttl)
            return True
        except Exception as e:
            logger.warning(f"Cache set error for key '{key}': {e}")
            return False
        
    async def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> bool:
        try:
            serialized = json.dumps(value)
            return await self.set(key, serialized, ttl_seconds)
        except Exception as e:
            logger.warning(f"Cache JSON serialize error for key '{key}': {e}")
            return False
            
    async def delete_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a glob pattern (e.g. 'events:*', 'stats:*')."""
        if not self._redis or not self.enabled:
            return 0
        try:
            deleted_count = 0
            keys = []
            async for k in self._redis.scan_iter(match=pattern, count=100):
                keys.append(k)
                if len(keys) >= 100:
                    deleted_count += await self._redis.delete(*keys)
                    keys = []
            if keys:
                deleted_count += await self._redis.delete(*keys)
            if deleted_count > 0:
                logger.info(f"Invalidated {deleted_count} cache keys matching '{pattern}'")
            return deleted_count
        except Exception as e:
            logger.warning(f"Cache delete_pattern error for '{pattern}': {e}")
            return 0
        
    async def is_healthy(self) -> bool:
        if not self._redis:
            return False
        try:
            return await self._redis.ping()
        except Exception:
            return False


cache_service = CacheService()