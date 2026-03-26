"""Test data factories for creating test database objects."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import MealType, ModerationStatus, ReportReason, Unit, Visibility
from app.features.auth.models import Device, User, UserDevice
from app.features.auth.service import issue_device_token
from app.features.catalog.models import CatalogPortion, CatalogProduct
from app.features.goals.models import UserGoal
from app.features.meals.models import FoodEntry
from app.features.moderation.models import ContentReport, UserBlock
from app.features.portions.models import ProductPortion
from app.features.products.models import Product
from app.features.shared.models import SharedFood, SharedFoodPortion
from app.features.water.models import WaterLog
from app.features.weights.models import BodyWeight


async def create_user(
    session: AsyncSession,
    **overrides,
) -> User:
    """Create a test user."""
    defaults = {
        "supabase_id": uuid.uuid4(),
        "email": f"test-{uuid.uuid4().hex[:8]}@test.com",
    }
    defaults.update(overrides)

    user = User(**defaults)
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def create_device(
    session: AsyncSession,
    **overrides,
) -> Device:
    """Create a test device with a valid token hash."""
    device_id = overrides.pop("id", uuid.uuid4())
    _token, token_hash = issue_device_token(device_id)

    defaults = {
        "id": device_id,
        "token_hash": token_hash,
        "created_at": datetime.now(UTC),
        "last_seen_at": datetime.now(UTC),
    }
    defaults.update(overrides)

    device = Device(**defaults)
    session.add(device)
    await session.flush()
    await session.refresh(device)
    return device


async def create_user_device(
    session: AsyncSession,
    user_id: uuid.UUID,
    device_id: uuid.UUID,
    **overrides,
) -> UserDevice:
    """Create a test user-device link."""
    defaults = {
        "user_id": user_id,
        "device_id": device_id,
    }
    defaults.update(overrides)

    user_device = UserDevice(**defaults)
    session.add(user_device)
    await session.flush()
    await session.refresh(user_device)
    return user_device


async def create_product(
    session: AsyncSession,
    device_id: uuid.UUID | None = None,
    *,
    user_id: uuid.UUID | None = None,
    **overrides,
) -> Product:
    """Create a test product."""
    defaults = {
        "device_id": device_id,
        "user_id": user_id,
        "name": f"Test Product {uuid.uuid4().hex[:8]}",
    }
    defaults.update(overrides)

    product = Product(**defaults)
    session.add(product)
    await session.flush()
    await session.refresh(product)
    return product


async def create_portion(
    session: AsyncSession,
    device_id: uuid.UUID | None = None,
    product_id: uuid.UUID | None = None,
    *,
    user_id: uuid.UUID | None = None,
    **overrides,
) -> ProductPortion:
    """Create a test product portion."""
    defaults = {
        "device_id": device_id,
        "user_id": user_id,
        "product_id": product_id,
        "label": f"Test Portion {uuid.uuid4().hex[:8]}",
        "base_amount": Decimal("100"),
        "base_unit": Unit.g,
        "calories": Decimal("200"),
        "protein": Decimal("10"),
        "carbs": Decimal("20"),
        "fat": Decimal("5"),
        "is_default": False,
    }
    defaults.update(overrides)

    portion = ProductPortion(**defaults)
    session.add(portion)
    await session.flush()
    await session.refresh(portion)
    return portion


async def create_food_entry(
    session: AsyncSession,
    device_id: uuid.UUID | None = None,
    product_id: uuid.UUID | None = None,
    portion_id: uuid.UUID | None = None,
    *,
    user_id: uuid.UUID | None = None,
    **overrides,
) -> FoodEntry:
    """Create a test food entry."""
    defaults = {
        "device_id": device_id,
        "user_id": user_id,
        "product_id": product_id,
        "portion_id": portion_id,
        "day": date.today(),
        "meal_type": MealType.breakfast,
        "amount": Decimal("100"),
        "unit": Unit.g,
    }
    defaults.update(overrides)

    entry = FoodEntry(**defaults)
    session.add(entry)
    await session.flush()
    await session.refresh(entry)
    return entry


async def create_goal(
    session: AsyncSession,
    device_id: uuid.UUID | None = None,
    *,
    user_id: uuid.UUID | None = None,
    **overrides,
) -> UserGoal:
    """Create a test user goal (manual goal by default)."""
    defaults = {
        "device_id": device_id,
        "user_id": user_id,
        "goal_type": "manual",
        "daily_calories_kcal": 2000,
        "protein_percent": 30,
        "carbs_percent": 40,
        "fat_percent": 30,
        "protein_grams": 150,
        "carbs_grams": 200,
        "fat_grams": 67,
        "water_ml": 2000,
    }
    defaults.update(overrides)

    goal = UserGoal(**defaults)
    session.add(goal)
    await session.flush()
    await session.refresh(goal)
    return goal


async def create_body_weight(
    session: AsyncSession,
    device_id: uuid.UUID | None = None,
    *,
    user_id: uuid.UUID | None = None,
    **overrides,
) -> BodyWeight:
    """Create a test body weight entry."""
    defaults = {
        "device_id": device_id,
        "user_id": user_id,
        "day": date.today(),
        "weight_kg": Decimal("70.5"),
    }
    defaults.update(overrides)

    weight = BodyWeight(**defaults)
    session.add(weight)
    await session.flush()
    await session.refresh(weight)
    return weight


async def create_catalog_product(
    session: AsyncSession,
    *,
    name: str,
    source: str = "usda",
    source_id: str | None = None,
    display_name: str | None = None,
    category: str | None = None,
    brand: str | None = None,
    barcode: str | None = None,
) -> CatalogProduct:
    """Create a test catalog product."""
    product = CatalogProduct(
        source=source,
        source_id=source_id if source_id is not None else uuid.uuid4().hex[:12],
        name=name,
        display_name=display_name if display_name is not None else name,
        category=category,
        brand=brand,
        barcode=barcode,
    )
    session.add(product)
    await session.flush()
    return product


async def create_catalog_portion(
    session: AsyncSession,
    *,
    catalog_product_id: uuid.UUID,
    label: str = "100 g",
    base_amount: Decimal = Decimal("100"),
    base_unit: Unit = Unit.g,
    gram_weight: Decimal | None = Decimal("100"),
    calories: Decimal = Decimal("0"),
    protein: Decimal | None = None,
    carbs: Decimal | None = None,
    fat: Decimal | None = None,
    is_default: bool = True,
) -> CatalogPortion:
    """Create a test catalog portion."""
    portion = CatalogPortion(
        catalog_product_id=catalog_product_id,
        label=label,
        base_amount=base_amount,
        base_unit=base_unit,
        gram_weight=gram_weight,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        is_default=is_default,
    )
    session.add(portion)
    await session.flush()
    return portion


async def create_shared_food(
    session: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    name: str | None = None,
    display_name: str | None = None,
    visibility: Visibility = Visibility.private,
    moderation_status: ModerationStatus = ModerationStatus.pending,
    **overrides,
) -> SharedFood:
    """Create a test shared food."""
    marker = uuid.uuid4().hex[:8]
    defaults: dict = {
        "owner_user_id": owner_user_id,
        "name": name or f"Shared Food {marker}",
        "display_name": display_name or name or f"Shared Food {marker}",
        "visibility": visibility,
        "moderation_status": moderation_status,
    }
    defaults.update(overrides)

    food = SharedFood(**defaults)
    session.add(food)
    await session.flush()
    await session.refresh(food)
    return food


async def create_shared_food_portion(
    session: AsyncSession,
    *,
    shared_food_id: uuid.UUID,
    label: str = "100 g",
    base_amount: Decimal = Decimal("100"),
    base_unit: Unit = Unit.g,
    calories: Decimal = Decimal("200"),
    is_default: bool = True,
    **overrides,
) -> SharedFoodPortion:
    """Create a test shared food portion."""
    defaults: dict = {
        "shared_food_id": shared_food_id,
        "label": label,
        "base_amount": base_amount,
        "base_unit": base_unit,
        "calories": calories,
        "is_default": is_default,
    }
    defaults.update(overrides)

    portion = SharedFoodPortion(**defaults)
    session.add(portion)
    await session.flush()
    await session.refresh(portion)
    return portion


async def create_water_log(
    session: AsyncSession,
    device_id: uuid.UUID | None = None,
    *,
    user_id: uuid.UUID | None = None,
    **overrides,
) -> WaterLog:
    """Create a test water log entry."""
    defaults: dict = {
        "device_id": device_id,
        "user_id": user_id,
        "day": date.today(),
        "amount_ml": 250,
    }
    defaults.update(overrides)

    water_log = WaterLog(**defaults)
    session.add(water_log)
    await session.flush()
    await session.refresh(water_log)
    return water_log


async def create_admin_user(
    session: AsyncSession,
    **overrides,
) -> User:
    """Create a test admin user."""
    return await create_user(session, is_admin=True, **overrides)


async def create_content_report(
    session: AsyncSession,
    *,
    reporter_user_id: uuid.UUID,
    target_shared_food_id: uuid.UUID,
    reason: ReportReason = ReportReason.inaccurate,
    detail: str | None = None,
    **overrides,
) -> ContentReport:
    """Create a test content report."""
    defaults: dict = {
        "reporter_user_id": reporter_user_id,
        "target_shared_food_id": target_shared_food_id,
        "reason": reason,
        "detail": detail,
    }
    defaults.update(overrides)

    report = ContentReport(**defaults)
    session.add(report)
    await session.flush()
    await session.refresh(report)
    return report


async def create_user_block(
    session: AsyncSession,
    *,
    blocker_user_id: uuid.UUID,
    blocked_user_id: uuid.UUID,
    **overrides,
) -> UserBlock:
    """Create a test user block."""
    defaults: dict = {
        "blocker_user_id": blocker_user_id,
        "blocked_user_id": blocked_user_id,
    }
    defaults.update(overrides)

    block = UserBlock(**defaults)
    session.add(block)
    await session.flush()
    await session.refresh(block)
    return block
