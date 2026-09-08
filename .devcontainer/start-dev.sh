#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export UBND_KTYTE_DATA_DIR="$ROOT_DIR/.data"
mkdir -p "$UBND_KTYTE_DATA_DIR"

if ! curl --silent --fail http://127.0.0.1:5022/swagger/index.html >/dev/null 2>&1; then
  (cd "$ROOT_DIR/backend" && nohup dotnet run --no-launch-profile --urls http://0.0.0.0:5022 > /tmp/ubnd-ktyte-backend.log 2>&1 &)
fi

if ! curl --silent --fail http://127.0.0.1:5173 >/dev/null 2>&1; then
  (cd "$ROOT_DIR/frontend" && nohup npm run dev -- --host 0.0.0.0 > /tmp/ubnd-ktyte-frontend.log 2>&1 &)
fi

echo "Frontend: http://localhost:5173"
echo "Backend Swagger: http://localhost:5022/swagger"
