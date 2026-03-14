from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_device_id
from app.features.data.service import delete_all_food_entries

router = APIRouter(prefix="/data", tags=["data"])


@router.delete("/reset", status_code=204, response_model=None)
async def reset_device_data(
    device_id: uuid.UUID = Depends(get_current_device_id),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await delete_all_food_entries(session, device_id=device_id)
    return Response(status_code=204)
