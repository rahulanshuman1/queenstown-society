#!/bin/bash
# Lets the website open the installed app: adds the queenstown:// address to the Android project made by "npx cap add android".
set -e
M=android/app/src/main/AndroidManifest.xml
[ -f "$M" ] || { echo "AndroidManifest.xml not found"; exit 1; }
if grep -q 'android:scheme="queenstown"' "$M"; then echo "already patched"; exit 0; fi
python3 - "$M" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
f='''
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="queenstown" />
            </intent-filter>
'''
i=s.index('</activity>')
open(p,'w').write(s[:i]+f+'        '+s[i:])
print("patched",p)
PY
