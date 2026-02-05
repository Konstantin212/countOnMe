from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in parent directory (root) first, then current directory
_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
_env_file = str(_root_env) if _root_env.exists() else ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file, env_file_encoding="utf-8", extra="ignore")

    env: str = "local"

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    database_url: str = "postgresql+asyncpg://countonme:countonme@db:5432/countonme"

    device_token_pepper: str = "change-me"


settings = Settings()

