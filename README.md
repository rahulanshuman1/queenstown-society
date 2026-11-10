# Queenstown Society app

One app for residents and the committee: notices, maintenance bills and UPI payments, events with a hero carousel and 30 day forecast, helpdesk, amenity booking, visitor passes, marketplace ads, polls, accounts, documents and a directory.

It is a Progressive Web App. The same files run in any browser and install on Android as an app.

## Files
- `index.html` the whole app (open it, or host it)
- `manifest.webmanifest`, `sw.js`, `icons/` make it installable and available offline
- `src/` readable source. Run `./build.sh` after editing to rebuild `index.html`

## Try it
Open `index.html` through any web server (for example `python3 -m http.server`) and use the demo logins on the first screen.

| Role | Login | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Resident | `9876500001` | `resident123` |

Registration flow: a new resident registers a flat, sees a "waiting for approval" screen, and gets access only after the admin approves under Members. Rejected requests see the reason.

Before going live: Society setup, then change the admin password, enter the society UPI ID, charges, due day and late fee, then press Clear demo data.

## Put it on the internet (free options)
Upload the folder to Netlify Drop, Cloudflare Pages, Firebase Hosting or GitHub Pages. It must be served over HTTPS for install and offline mode.

## Android app

**Option A, install from the browser (no tools needed).** Open the hosted address in Chrome on the phone, tap the menu, then Install app (Add to Home screen). It opens full screen with its own icon.

**Option B, a real APK or Play Store listing with PWABuilder.**
1. Host the app on HTTPS.
2. Go to pwabuilder.com, enter the address and press Package for stores, then Android.
3. Download the package. It contains the signed APK or AAB and the `assetlinks.json` file to host at `/.well-known/assetlinks.json`.
4. Upload the AAB to Google Play Console (one time USD 25 developer fee), or share the APK directly.

**Option C, Capacitor wrapper (needs Node and Android Studio).**
```
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Queenstown Society" in.queenstown.society --web-dir=www
mkdir www && cp index.html manifest.webmanifest sw.js www/ && cp -r icons www/
npx cap add android && npx cap sync && npx cap open android
```
Build the APK from Android Studio. Capacitor also gives push notifications and camera access later.

## Important: the demo stores data in each phone's browser
This version keeps all data in the browser's local storage. That is perfect for trying every screen, but a resident's registration will not appear on the admin's phone. For the real society you need one shared database. The app already isolates all reads and writes behind `DB` and `save()`, so the move is mechanical:

1. Create a Firebase project (Auth with phone number sign in, Firestore, Cloud Messaging) or a Supabase project (Postgres, Auth, Row Level Security).
2. Collections or tables: `users`, `notices`, `events`, `bills`, `complaints`, `bookings`, `visitors`, `ads`, `polls`, `docs`, `entries`, `schedule`, `settings`.
3. Rules: residents read all notices and events, read and write only their own flat's bills (status `verifying` only), tickets, bookings and visitors. Only an `admin` custom claim can approve users, verify payments, publish notices and edit settings.
4. Move password checking and approval to the server. The browser hashing used here is for the demo only.
5. Replace UPI "I have paid" with a payment gateway (Razorpay or Cashfree) later if you want automatic verification.
6. Store event photos in Firebase Storage or Supabase Storage instead of the browser.

I can do this migration as the next step.
