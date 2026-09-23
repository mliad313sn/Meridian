#!/usr/bin/env bash
# Restart the dev server gracefully.
#
# PGlite does not survive a hard kill with its data directory intact — a
# SIGKILL mid-write corrupts the control file and the next start aborts.
# So this asks the process to stop and gives it time to flush.
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-4173}"
# The README tells everyone to run this with bash, but it only knew how
# to find the listener through powershell.exe — on Linux and macOS it
# found nothing, stopped nothing, and started a second server against the
# same PGlite directory. Windows keeps its path; elsewhere lsof, then ss.
if command -v powershell.exe >/dev/null 2>&1; then
  PID=$(powershell.exe -NoProfile -Command \
    "(Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue).OwningProcess" \
    2>/dev/null | tr -d '\r\n ')
  if [ -n "${PID:-}" ]; then
    echo "stopping pid $PID on port $PORT"
    powershell.exe -NoProfile -Command "Stop-Process -Id $PID" >/dev/null 2>&1
    sleep 3
  fi
else
  PID=""
  if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  elif command -v ss >/dev/null 2>&1; then
    PID=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
  fi
  if [ -n "${PID:-}" ]; then
    echo "stopping pid $PID on port $PORT"
    kill -TERM "$PID" 2>/dev/null   # SIGTERM, never SIGKILL: PGlite must flush
    for i in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
    if kill -0 "$PID" 2>/dev/null; then
      echo "pid $PID is still running after 10s — not starting a second server on the same data directory"
      exit 1
    fi
  fi
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
