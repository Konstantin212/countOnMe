#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/backend"
python -m scripts.seed_catalog "$@"
