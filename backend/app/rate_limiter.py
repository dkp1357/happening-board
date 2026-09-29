from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address, 
    storage_uri=settings.get_redis_url,
    strategy="moving-window" # sliding-window
    )