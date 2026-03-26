from __future__ import annotations

import logging
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in parent directory (root) first, then current directory
_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
_env_file = str(_root_env) if _root_env.exists() else ".env"

logger = logging.getLogger(__name__)

_WEAK_PEPPERS = {"change-me", "change-me-in-production", ""}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_env_file, env_file_encoding="utf-8", extra="ignore")

    env: str = "local"

    api_host: str = "0.0.0.0"  # noqa: S104
    api_port: int = 8000

    database_url: str = "postgresql+asyncpg://countonme:countonme@db:5432/countonme"

    device_token_pepper: str  # Required — no default; must be set via env var

    # Supabase Auth — JWKS-based JWT verification (no shared secret needed)
    supabase_secret_key: str = ""  # sb_secret_... — for admin operations (replaces legacy service_role)
    supabase_url: str = ""


settings = Settings()

if settings.device_token_pepper in _WEAK_PEPPERS:
    if settings.env == "local":
        logger.warning(
            "DEVICE_TOKEN_PEPPER is weak ('%s'). "
            "Set a cryptographically random value (32+ chars) before deploying.",
            settings.device_token_pepper,
        )
    else:
        msg = (
            "DEVICE_TOKEN_PEPPER must be a strong secret in non-local environments. "
            "Set DEVICE_TOKEN_PEPPER to a cryptographically random string (32+ chars)."
        )
        raise ValueError(msg)

# Validate supabase_url (required for JWKS verification and Admin API)
if not settings.supabase_url:
    if settings.env == "local":
        logger.warning(
            "SUPABASE_URL is not set. "
            "Supabase JWT auth and Admin API will not work.",
        )
    else:
        msg = (
            "SUPABASE_URL must be set in non-local environments. "
            "Set SUPABASE_URL to your Supabase project URL (https://<ref>.supabase.co)."
        )
        raise ValueError(msg)
elif settings.env != "local" and not settings.supabase_url.startswith("https://"):
    msg = (
        "SUPABASE_URL must use HTTPS in non-local environments. "
        f"Got: {settings.supabase_url}"
    )
    raise ValueError(msg)

