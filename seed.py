#!/usr/bin/env python
"""Seed the catalog. Run from anywhere: python seed.py [--dry-run]"""
import os
import subprocess
import sys

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://countonme:countonme@localhost:5433/countonme",
)

backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.exit(subprocess.call([sys.executable, "-m", "scripts.seed_catalog", *sys.argv[1:]], cwd=backend_dir))
