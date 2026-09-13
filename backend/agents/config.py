from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/leetcoach_ai"
    REDIS_URL: str = "redis://localhost:6379"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-pro"
    AGENT_SECRET: str = "dev-secret"
    AGENT_PORT: int = 8001

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
