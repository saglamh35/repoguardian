#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "--rebuild" ]; then
  docker compose up -d --build
else
  docker compose up -d
fi
pnpm -C web install
if [ ! -f web/.env.local ]; then
  cp web/.env.local.sample web/.env.local
  echo "Created web/.env.local from sample."
fi
pnpm -C web dev
