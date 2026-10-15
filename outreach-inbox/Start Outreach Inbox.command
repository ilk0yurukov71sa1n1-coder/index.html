#!/bin/bash
# Rollcfluence Outreach Inbox: double-click in Finder to start.
# Runs only while this window is open. Closing the window stops everything.

cd "$(dirname "$0")" || exit 1
export NEXT_TELEMETRY_DISABLED=1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT=3838
URL="http://localhost:$PORT"

echo "Rollcfluence Outreach Inbox"
echo "---------------------------"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Opening nodejs.org: install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  read -r -p "Press Enter to close."
  exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 22 ]; then
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

if [ ! -f .env.local ]; then
  echo ""
  echo "No email account is set up yet."
  read -r -p "Set up email now? (Y/n) " ANSWER
  if [[ ! "$ANSWER" =~ ^[Nn] ]]; then
    node scripts/setup-email.mjs
  else
    echo "Skipped. You can still add leads and use assisted DMs. Run 'npm run setup-email' later."
  fi
fi

if [ ! -f .next/BUILD_ID ] || [ -n "$(find app components lib instrumentation.ts next.config.ts package.json -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
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
echo "Your data stays in the data/ folder on this Mac. Replies are checked every 2 minutes while this window is open."
echo "To stop: close this window, or press Ctrl+C."
wait "$SERVER_PID"
