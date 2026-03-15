#!/usr/bin/env python
"""Seed the catalog. Run from repo root:

    python seed.py                          # seed all sources
    python seed.py --sources usda           # seed USDA only
    python seed.py --sources off            # seed OFF only
    python seed.py --dry-run                # preview without writing
    python seed.py --sources usda --dry-run # preview USDA only

Requires: asyncpg (pip install asyncpg)
Database defaults to localhost:5433 (Docker Compose dev setup).
"""
import os
import subprocess
import sys

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://countonme:countonme@localhost:5433/countonme",
)

repo_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(repo_dir, "backend")
seeds_dir = os.path.join(repo_dir, "seeds")

sys.exit(subprocess.call(
    [sys.executable, "-m", "scripts.seed_catalog", "--seeds-dir", seeds_dir, *sys.argv[1:]],
    cwd=backend_dir,
))
