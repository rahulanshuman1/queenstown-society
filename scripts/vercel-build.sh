#!/bin/bash
# Vercel build: builds the app and writes the API address from the QS_API_URL environment variable.
set -e
cd "$(dirname "$0")/.."
chmod +x build.sh && ./build.sh
rm -rf www && mkdir -p www
cp index.html manifest.webmanifest sw.js offline.html www/
cp -r icons assets www/
API="${QS_API_URL:-}"
API="${API%/}"
APK="${QS_APK_URL:-}"
if [ -z "$APK" ] && [ -n "${VERCEL_GIT_REPO_OWNER:-}" ] && [ -n "${VERCEL_GIT_REPO_SLUG:-}" ]; then
  # the APK workflow publishes this file to the "app-latest" release of the same repository
  APK="https://github.com/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/releases/download/app-latest/queenstown-society.apk"
fi
printf 'window.QS_API = "%s";\nwindow.QS_APK_URL = "%s";\n' "$API" "$APK" > www/config.js
echo "Built www/ with API address: ${API:-<none, local demo mode>}, app download: ${APK:-<none>}"
