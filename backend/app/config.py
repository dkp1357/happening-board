from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "happening-board"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    
    # PostgreSQL Configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "happening_board"
    DATABASE_URL: str | None = None 
    
    @property
    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    REDIS_URL: str | None = None
    CACHE_ENABLED: bool = True
    CACHE_DEFAULT_TTL: int = 5*60  # in seconds, 5 mins
    
    @property
    def get_redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Ingestion Security (Lock down trigger endpoint)
    INGEST_API_KEY: str = "hb_secret_ingest_key_change_me_in_prod"
    
    # Scheduling Mode
    # By default, internal scheduling is disabled in favor of external cron (GitHub Actions)
    ENABLE_INTERNAL_SCHEDULER: bool = False
    AUTO_INGEST_ON_STARTUP: bool = False
    INGEST_INTERVAL_MINUTES: int = 15
    MAX_EVENTS_PER_INGEST: int = 50

    # Groq AI Configuration
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_BATCH_SIZE: int = 5
    AI_ENRICHMENT_ENABLED: bool = True
    
    # GDELT Ingestion Source
    GDELT_LAST_UPDATE_URL: str = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
    GDELT_DOC_API_URL: str = "https://api.gdeltproject.org/api/v2/doc/doc"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # cors settings
    cors_origins: str = ""
    cors_methods: str = ""
    cors_headers: str = ""
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def cors_methods_list(self) -> list[str]:
        return [x.strip() for x in self.cors_methods.split(",") if x.strip()]

    @property
    def cors_headers_list(self) -> list[str]:
        return [x.strip() for x in self.cors_headers.split(",") if x.strip()]
    
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
settings = Settings()