"""
Application configuration via Pydantic Settings.
Loaded from environment variables / .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Groq (free tier — https://console.groq.com)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_max_tokens: int = 4096
    groq_temperature: float = 0.1
    groq_rate_limit_delay: float = 2.0    # seconds between calls (free tier: 30 req/min)
    groq_rate_limit_cooldown: int = 65    # seconds to pause when 429 is received

    # Database
    database_url: str = "sqlite:///./audit_agent.db"

    # File storage
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50

    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Logging
    log_level: str = "INFO"

    # Evidence chunking
    max_chars_per_file: int = 12000  # ~3000 tokens
    max_input_tokens: int = 150000

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
