#!/bin/bash
# Builds: dist/app.html (artifact preview, no doctype) and index.html (installable PWA)
set -e
cd "$(dirname "$0")"
mkdir -p dist
FONTS='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Manrope:wght@400;500;600;700;800&display=swap">'
BODY='<div id="app"></div><div id="modal-root"></div><div id="toasts" aria-live="polite"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>'"$(cat src/core.js src/ui.js src/views1.js src/views2.js src/studio.js src/views3.js)"'</script>'
# artifact version: no doctype/html/head
{
echo '<title>Queenstown Society</title>'
echo '<meta name="claude:viewport-fit-sides" content="cover">'
echo "$FONTS"
echo '<style>'; cat src/styles.css; echo '</style>'
echo "$BODY"
} > dist/app.html
# PWA version
{
cat <<'HEAD'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Queenstown Society</title><meta name="description" content="Notices, maintenance payments, events and bookings for Queenstown Society.">
<meta name="theme-color" content="#0B3B3A"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icons/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Queenstown">
HEAD
echo '<script src="config.js"></script>'
echo "$FONTS"
echo '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}'; cat src/styles.css; echo '</style></head><body>'
echo "$BODY"
echo '</body></html>'
} > index.html
echo built $(wc -c < dist/app.html) bytes
