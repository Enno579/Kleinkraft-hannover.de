#!/bin/bash
cd "$(dirname "$0")/public"
PORT=8765
# kill old server on port if needed
lsof -ti :$PORT | xargs kill -9 2>/dev/null
python3 -m http.server $PORT &
sleep 1
open "http://localhost:$PORT/index.html"
echo "Webseite läuft auf http://localhost:$PORT"
echo "Fenster offen lassen — Server läuft im Hintergrund"
read -p "Enter zum Beenden..."
lsof -ti :$PORT | xargs kill -9 2>/dev/null
