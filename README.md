# Queenstown Society

One app for residents and the committee: notices, maintenance bills with online payment, events with a hero carousel and 30 day forecast, helpdesk, amenity booking, visitor passes, marketplace ads, polls, accounts, documents and a directory.

New residents register their flat and get access only after the admin approves them.

## How it is built

| Folder | What |
|---|---|
| `src/`, `build.sh` | The web app (plain HTML, CSS and JavaScript). `./build.sh` writes `index.html`. |
| `server/` | The API: Node.js, MongoDB driver, no other packages. Roles, approval rules and Razorpay. |
| `vercel.json`, `scripts/` | Vercel build. Reads `QS_API_URL` and writes `config.js`. |
| `render.yaml` | Render blueprint for the API. |
| `capacitor.config.json`, `.github/workflows/` | Android APK build in GitHub Actions. |

**Go live: read [DEPLOY.md](DEPLOY.md).** **Android APK: read [ANDROID.md](ANDROID.md).**

## Site studio (admin)

Admin > **Site studio** edits how the whole site looks and reads, without touching code:

- Logo (upload), society name and tagline
- Festive theme: Diwali, Holi, Christmas, New Year, Republic Day, Eid, Navratri, Ganesh Chaturthi or custom colours, with start and end dates, a greeting bar and optional falling effects
- Landing page headline, intro, the three steps, the welcome line inside the app and an announcement bar
- Footer: text, contact details, links, social links and a footer photo (upload)

**Preview** shows the draft on the public page or inside the app without saving. **Discard** throws the draft away (tap twice). **Save changes** publishes it for everyone. Uploaded images are resized in the browser and checked again on the server.

Notices, events and ads keep their own admin screens. **Publish notice** and **Add event** accept one attached file (PDF, image, Word or Excel, up to 5 MB). Residents tap Preview or Download, on the website and in the Android app.

The society logo is animated (castle rises, name appears letter by letter, golden shine) on the splash screen and the public page. Uploading a logo in Site studio replaces it.

## Two ways to run the app

- **With an API address** (`window.QS_API` in `config.js`, set from `QS_API_URL` on Vercel): real accounts, one shared database, admin approval across phones, Razorpay payments.
- **Without one** (the default in this repo): a demo that keeps everything in the browser, with sample residents, bills and events. Good for trying the screens. Demo logins: admin `admin` / `admin123`, resident `9876500001` / `resident123`.

## Server rules in short

- Everything is checked on the server. Residents cannot change prices, bill status, other flats' data, their own approval or any admin content, even by editing requests in the browser.
- Pending and rejected residents get no society data at all.
- Passwords are hashed with scrypt. Sign-in is rate limited.
- Bills are paid online only through Razorpay, confirmed by signature or webhook.

## Tests

```
cd server && npm test
```

29 tests cover registration, approval, roles, private data, site settings and image limits, bill rules, and every Razorpay case: amounts set by the server, late fees, wrong signatures, another resident's order, repeated webhooks and amount mismatch.

## Before real residents use it

1. Follow DEPLOY.md with Razorpay in Test Mode and pay one bill.
2. Switch Razorpay to Live Mode (needs KYC in the society's name) and update the two Render variables and the webhook.
3. Change the admin password if it was ever shared.

## Security desk (visitor management)
- **Admin** adds guards in Members > Security (name, mobile, password). Guards sign in with that mobile number and only see the Security desk and Notices.
- **Guard** taps New visitor, picks the flat, types the name, takes a photo and sends the request. The resident is notified and answers Approve or Deny. The guard sees the answer within seconds, then taps Allow entry and later Mark exit. Pre-approved visitors are let in with their 6 digit code.
- **Residents** get a pop-up with the visitor photo while the app is open (with a sound and, if allowed, a browser notification). Everyone approved in the flat is asked, and any of them can answer. Visitors show in Visitors with photo, entry and exit times.
- Visitor photos are shrunk on the phone to about 40 KB and photos older than two weeks are dropped from the live view to keep pages light.
- Demo mode has a guard: `9876500099` / `guard123`.
- **Not included:** alerts when the app is completely closed need Firebase push notifications, which is a separate set up.
