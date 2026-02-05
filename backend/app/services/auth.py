from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.settings import settings


@dataclass(frozen=True)
class ParsedDeviceToken:
    device_id: uuid.UUID
    secret: str


def _hash_secret(secret: str) -> str:
    """Hash secret with pepper using SHA-256 (tokens are already cryptographically random)."""
    peppered = f"{secret}.{settings.device_token_pepper}"
    return hashlib.sha256(peppered.encode()).hexdigest()


def issue_device_token(device_id: uuid.UUID) -> tuple[str, str]:
    """Return (device_token, token_hash_to_store)."""
    secret = secrets.token_urlsafe(32)
    token_hash = _hash_secret(secret)
    token = f"{device_id}.{secret}"
    return token, token_hash


def parse_device_token(token: str) -> ParsedDeviceToken | None:
    try:
        device_id_raw, secret = token.split(".", 1)
        return ParsedDeviceToken(device_id=uuid.UUID(device_id_raw), secret=secret)
    except Exception:
        return None


def verify_device_token(secret: str, token_hash: str) -> bool:
    computed = _hash_secret(secret)
    return hmac.compare_digest(computed, token_hash)


async def get_device_by_id(session: AsyncSession, device_id: uuid.UUID) -> Device | None:
    res = await session.execute(select(Device).where(Device.id == device_id))
    return res.scalar_one_or_none()


async def touch_device_last_seen(session: AsyncSession, device: Device) -> None:
    device.last_seen_at = datetime.now(timezone.utc)
    session.add(device)

