#!/bin/bash
cd "$(dirname "$0")/public"
lsof -ti :8765 | xargs kill -9 2>/dev/null
python3 -m http.server 8765 &
sleep 2
open "http://localhost:8765/index.html"
