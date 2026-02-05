from __future__ import annotations

from fastapi import APIRouter, FastAPI

from app.api.routers.devices import router as devices_router
from app.api.routers.food_entries import router as food_entries_router
from app.api.routers.portions import router as portions_router
from app.api.routers.products import router as products_router
from app.api.routers.stats import router as stats_router
from app.api.routers.sync import router as sync_router
from app.api.routers.weights import router as weights_router


def create_app() -> FastAPI:
    app = FastAPI(title="CountOnMe API", version="0.1.0")

    app.get("/health", tags=["health"])(lambda: {"ok": True})

    v1 = APIRouter(prefix="/v1")
    v1.include_router(devices_router)
    v1.include_router(products_router)
    v1.include_router(portions_router)
    v1.include_router(food_entries_router)
    v1.include_router(stats_router)
    v1.include_router(sync_router)
    v1.include_router(weights_router)
    app.include_router(v1)

    return app


app = create_app()

