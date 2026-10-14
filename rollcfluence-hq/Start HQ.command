#!/bin/bash
# Rollcfluence HQ: double-click in Finder to start.
# Runs only while this window is open. Closing the window stops everything.

cd "$(dirname "$0")" || exit 1
export NEXT_TELEMETRY_DISABLED=1
# node:sqlite prints an "experimental" notice on every start; it is harmless, so hide it.
export NODE_OPTIONS="--disable-warning=ExperimentalWarning"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT=3900
URL="http://localhost:$PORT"

echo "Rollcfluence HQ"
echo "---------------"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Opening nodejs.org: install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -r -p "Press Enter to close."
  exit 1
fi

NODE_OK=$(node -p 'const [a,b]=process.versions.node.split(".").map(Number); a>22||(a===22&&b>=13)?1:0')
if [ "$NODE_OK" != "1" ]; then
  echo "Node.js $(node -v) is too old. Please install the LTS version from nodejs.org."
  open "https://nodejs.org/en/download"
  read -r -p "Press Enter to close."
  exit 1
fi

# Already running in another window? Just open it.
if curl -s -o /dev/null "$URL"; then
  echo "Already running. Opening $URL"
  open "$URL"
  exit 0
fi

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "First run: installing (about a minute)..."
  npm install --no-audit --no-fund || { read -r -p "Install failed. Press Enter to close."; exit 1; }
  touch node_modules
fi

if [ ! -f .next/BUILD_ID ] || [ -n "$(find app components core modules instrumentation.ts next.config.ts package.json -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
  echo "Building the app..."
  npm run build || { read -r -p "Build failed. Press Enter to close."; exit 1; }
fi

node node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!

# Stop the server and everything it started when this window closes.
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null
}
cleanup() {
  trap - EXIT INT TERM HUP
  kill_tree "$SERVER_PID"
  exit 0
}
trap cleanup EXIT INT TERM HUP

for _ in $(seq 1 60); do
  curl -s -o /dev/null "$URL" && break
  sleep 0.5
done

open "$URL"
echo ""
echo "Running at $URL (only on this computer)."
echo "Your data stays in the data/ folder on this Mac. A backup was made just now."
echo "To stop: close this window, or press Ctrl+C."
wait "$SERVER_PID"
