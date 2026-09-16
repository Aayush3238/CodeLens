from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/leetcoach_ai"
    REDIS_URL: str = "redis://localhost:6379"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-pro"
    AGENT_SECRET: str = "dev-secret"
    AGENT_PORT: int = 8001
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    if settings.ENVIRONMENT == "production":
        if settings.AGENT_SECRET == "dev-secret":
            raise ValueError("AGENT_SECRET must be set in production")
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY must be set in production")
    return settings
