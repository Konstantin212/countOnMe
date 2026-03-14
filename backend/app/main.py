from __future__ import annotations

from fastapi import APIRouter, FastAPI

from app.features.auth.router import router as devices_router
from app.features.catalog.router import router as catalog_router
from app.features.data.router import router as data_router
from app.features.goals.router import router as goals_router
from app.features.meals.router import router as food_entries_router
from app.features.portions.router import router as portions_router
from app.features.products.router import router as products_router
from app.features.stats.router import router as stats_router
from app.features.sync.router import router as sync_router
from app.features.weights.router import router as weights_router


def create_app() -> FastAPI:
    app = FastAPI(title="CountOnMe API", version="0.1.0")

    app.get("/health", tags=["health"])(lambda: {"ok": True})

    v1 = APIRouter(prefix="/v1")
    v1.include_router(devices_router)
    v1.include_router(products_router)
    v1.include_router(portions_router)
    v1.include_router(food_entries_router)
    v1.include_router(goals_router)
    v1.include_router(stats_router)
    v1.include_router(sync_router)
    v1.include_router(weights_router)
    v1.include_router(catalog_router)
    v1.include_router(data_router)
    app.include_router(v1)

    return app


app = create_app()

