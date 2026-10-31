#!/bin/sh
# Reframe — run locally with one command:  ./run.sh  (or: python3 -m http.server 5173)
cd "$(dirname "$0")"
PORT="${PORT:-5173}"
echo "Reframe running at: http://localhost:$PORT"
python3 -m http.server "$PORT"
