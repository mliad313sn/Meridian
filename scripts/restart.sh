#!/usr/bin/env bash
# Restart the dev server gracefully.
#
# PGlite does not survive a hard kill with its data directory intact — a
# SIGKILL mid-write corrupts the control file and the next start aborts.
# So this asks the process to stop and gives it time to flush.
#
# It used to find the pid through powershell.exe, which exists only under
# Windows. On Linux — where the fleet of docs/34 §8 actually runs — the
# expression was empty, nothing was ever stopped, and the script simply
# launched a SECOND server over the same PGlite book: the corruption it
# exists to prevent. (Operations counsellor no. 5, docs/33 §5.)
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-4173}"

# Who is listening, on whichever of the three tools this host carries.
listener() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1; return
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$PORT" 2>/dev/null | tr -d ' \n' | head -1; return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -lptnH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2; return
  fi
  if command -v powershell.exe >/dev/null 2>&1; then   # Windows, as before
    powershell.exe -NoProfile -Command \
      "(Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue).OwningProcess" \
      2>/dev/null | tr -d '\r\n '
  fi
}

PID="$(listener)"
if [ -n "${PID:-}" ]; then
  echo "stopping pid $PID on port $PORT"
  kill -TERM "$PID" 2>/dev/null || powershell.exe -NoProfile -Command "Stop-Process -Id $PID" >/dev/null 2>&1
  # Wait for it to let go of the book rather than guessing at three seconds.
  for _ in $(seq 1 20); do
    kill -0 "$PID" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$PID" 2>/dev/null; then
    echo "pid $PID is still running after 20s — it holds the book; stop it yourself rather than risk two writers"
    exit 1
  fi
fi

PORT="$PORT" \
  node scripts/dev.mjs > /tmp/meridian-server.log 2>&1 &

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
