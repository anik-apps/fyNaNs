#!/bin/bash
# Auto-restart Next.js dev server when source files change.
# Usage: ./dev-watch.sh
# Useful when external tools (Claude, scripts) modify files and HMR doesn't pick them up.

cd "$(dirname "$0")"

cleanup() {
  echo "Stopping..."
  kill $DEV_PID 2>/dev/null
  kill $WATCH_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

start_dev() {
  rm -rf .next
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8888}" pnpm dev &
  DEV_PID=$!
  echo "Dev server started (PID: $DEV_PID)"
}

LAST_HASH=""

get_hash() {
  find src -name '*.tsx' -o -name '*.ts' -o -name '*.css' 2>/dev/null | sort | xargs md5 -q 2>/dev/null | md5 -q
}

start_dev

while true; do
  sleep 3
  NEW_HASH=$(get_hash)
  if [ -n "$NEW_HASH" ] && [ "$NEW_HASH" != "$LAST_HASH" ] && [ -n "$LAST_HASH" ]; then
    echo ""
    echo "🔄 File change detected, restarting dev server..."
    kill $DEV_PID 2>/dev/null
    wait $DEV_PID 2>/dev/null
    start_dev
  fi
  LAST_HASH="$NEW_HASH"
done
