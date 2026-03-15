"""Seed the catalog_products and catalog_portions tables from multiple sources.

Usage (from backend/ directory):
    python -m scripts.seed_catalog [--seeds-dir PATH] [--sources {usda,off,all}] [--dry-run]

Delegates to source-specific seeders:
- USDA: reads SR Legacy JSON, cleans names, upserts products + portions
- OFF:  reads pre-filtered CSV (from prepare_off_data.py), upserts branded products

The script uses asyncpg directly with asyncio.run() so it can be run
without importing from app.settings (which requires DEVICE_TOKEN_PEPPER).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import sys
from pathlib import Path

from scripts.seeders.off import OffSeeder
from scripts.seeders.usda import UsdaSeeder

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Database URL helpers
# ---------------------------------------------------------------------------

def _asyncpg_url(url: str) -> str:
    """Convert any postgres URL variant to a plain asyncpg-compatible URL."""
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    url = re.sub(r"^postgres\+asyncpg://", "postgresql://", url)
    url = re.sub(r"^postgres://", "postgresql://", url)
    return url


def _load_database_url() -> str:
    """Read DATABASE_URL from env or .env file at repo root."""
    url = os.environ.get("DATABASE_URL")
    if url:
        return _asyncpg_url(url)

    # Try .env at repo root (two levels up from backend/scripts/)
    repo_root = Path(__file__).resolve().parent.parent.parent
    env_file = repo_root / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                _, _, raw = line.partition("=")
                raw = raw.strip().strip("\"'")
                return _asyncpg_url(raw)

    raise RuntimeError(
        "DATABASE_URL not set. "
        "Set it as an environment variable or add DATABASE_URL= to .env at repo root."
    )


# ---------------------------------------------------------------------------
# Seed logic (async, using asyncpg)
# ---------------------------------------------------------------------------

async def _seed_async(seeds_dir: str, *, sources: str, dry_run: bool) -> None:
    """Async seeding routine — delegates to source-specific seeders."""
    import asyncpg  # type: ignore[import-untyped]

    run_usda = sources in ("usda", "all")
    run_off = sources in ("off", "all")

    if dry_run:
        # Dry-run doesn't need a DB connection
        if run_usda:
            usda = UsdaSeeder(seeds_dir)
            products, portions = await usda.run(None, dry_run=True)  # type: ignore[arg-type]
            logger.info("[dry-run] USDA: %d products would be seeded.", products)
        if run_off:
            off = OffSeeder(seeds_dir)
            products, portions = await off.run(None, dry_run=True)  # type: ignore[arg-type]
            logger.info("[dry-run] OFF: %d products would be seeded.", products)
        return

    database_url = _load_database_url()
    conn = await asyncpg.connect(database_url)
    try:
        async with conn.transaction():
            if run_usda:
                usda = UsdaSeeder(seeds_dir)
                products, portions = await usda.run(conn, dry_run=False)
                logger.info("USDA: %d products, %d portions seeded.", products, portions)
            if run_off:
                off = OffSeeder(seeds_dir)
                products, portions = await off.run(conn, dry_run=False)
                logger.info("OFF: %d products, %d portions seeded.", products, portions)
    except Exception:
        logger.exception("Seed failed — rolled back all changes.")
        sys.exit(1)
    finally:
        await conn.close()

    print("Seed complete.")  # noqa: T201


def seed(seeds_dir: str, *, sources: str, dry_run: bool) -> None:
    asyncio.run(_seed_async(seeds_dir, sources=sources, dry_run=dry_run))


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the CountOnMe catalog from USDA and/or Open Food Facts.",
    )
    parser.add_argument(
        "--seeds-dir",
        default=str(Path(__file__).resolve().parent.parent.parent / "seeds"),
        help="Directory containing seed data files (default: <repo>/seeds/)",
    )
    parser.add_argument(
        "--sources",
        choices=["usda", "off", "all"],
        default="all",
        help="Which data sources to seed (default: all)",
    )
    parser.add_argument(
        "--db-url",
        default=None,
        help="PostgreSQL connection URL (overrides DATABASE_URL env var)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate without writing to the database.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    if args.db_url:
        os.environ["DATABASE_URL"] = args.db_url
    seed(args.seeds_dir, sources=args.sources, dry_run=args.dry_run)
