#!/bin/bash
# Vercel build: builds the app and writes the API address from the QS_API_URL environment variable.
set -e
cd "$(dirname "$0")/.."
chmod +x build.sh && ./build.sh
rm -rf www && mkdir -p www
cp index.html manifest.webmanifest sw.js www/
cp -r icons www/
API="${QS_API_URL:-}"
API="${API%/}"
printf 'window.QS_API = "%s";\n' "$API" > www/config.js
echo "Built www/ with API address: ${API:-<none, local demo mode>}"
