#!/usr/bin/env bash
# Restart the dev server gracefully.
#
# PGlite does not survive a hard kill with its data directory intact — a
# SIGKILL mid-write corrupts the control file and the next start aborts.
# So this asks the process to stop and gives it time to flush.
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-4173}"
PID=$(powershell.exe -NoProfile -Command \
  "(Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue).OwningProcess" \
  2>/dev/null | tr -d '\r\n ')

if [ -n "${PID:-}" ]; then
  echo "stopping pid $PID on port $PORT"
  powershell.exe -NoProfile -Command "Stop-Process -Id $PID" >/dev/null 2>&1
  sleep 3
fi

PGLITE_DIR="${PGLITE_DIR:-./server/.data/pgdata}" PORT="$PORT" \
  node server/src/index.js > /tmp/meridian-server.log 2>&1 &

for i in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    curl -s "http://localhost:$PORT/api/health"; echo
    exit 0
  fi
  sleep 1
done
echo "server did not come up; last lines of the log:"
grep -v "chunk-\|wasm-\|^import{" /tmp/meridian-server.log | tail -10
exit 1
