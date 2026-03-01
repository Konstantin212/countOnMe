#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/backend"
# Default to host-accessible DB URL (port 5433 exposed by docker-compose).
# Override by setting DATABASE_URL in your environment before running.
export DATABASE_URL="${DATABASE_URL:-postgresql://countonme:countonme@localhost:5433/countonme}"
python -m scripts.seed_catalog "$@"
