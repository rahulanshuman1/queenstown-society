# Deploy Queenstown Society

Three services, all with a free starting plan:

| Part | Service | What it does |
|---|---|---|
| Website | **Vercel** | Serves the app (the files in this repo) |
| API | **Render** | Runs `server/`: sign in, approvals, bills, Razorpay |
| Database | **MongoDB Atlas** | Stores everything |
| Payments | **Razorpay** | Takes UPI, card and net banking payments |

```
Phone or computer  →  Vercel (app)  →  Render (API)  →  MongoDB Atlas
                                          ↑
                        Razorpay  ────────┘  (payment confirmation webhook)
```

Do the steps in this order. Each step gives you one value for the next.

## 1. MongoDB Atlas (database)

1. Create a free account at mongodb.com/atlas and create a **free (M0) cluster**.
2. **Database Access**: add a database user with a password. Use letters and digits only, so the password needs no special encoding.
3. **Network Access**: add the IP address `0.0.0.0/0`. Render's free plan has no fixed IP address, so this is the only way to allow it. The database user and password still protect it.
4. **Connect > Drivers**: copy the connection string. It looks like `mongodb+srv://user:password@cluster0.abcde.mongodb.net/`. Put your real password in place of `<password>`.

Keep this as **MONGODB_URI**. The app creates its collections by itself on first start.

The free cluster has no scheduled backups. Use **Society setup > Data > Backup** in the app now and then.

## 2. Razorpay (payments)

Card and net banking are not offered in the app. Residents pay by UPI or bank transfer.

1. Create an account at razorpay.com. Stay in **Test Mode** (toggle at the top of the dashboard) until everything works.
2. **Account & Settings > API Keys > Generate Key.** Copy the **Key Id** (`rzp_test_...`) and the **Key Secret**. The secret is shown only once.
3. **Account & Settings > Payment capture**: choose **Automatic**, so a successful payment is captured without anyone clicking in the dashboard.
4. You create the webhook in step 3, after Render gives you an address.

For real money later: Razorpay asks for KYC in the society's name (registration certificate, PAN, bank account). After it activates your account, generate **Live Mode** keys and repeat the webhook there. Test and Live have separate keys and separate webhooks.

## 3. Render (API)

1. Push this repo to GitHub.
2. Render dashboard: **New > Blueprint**, choose the repo. Render reads `render.yaml` and creates the `queenstown-api` service.
3. Fill in the values it asks for:

| Variable | Value |
|---|---|
| `MONGODB_URI` | From step 1 |
| `ADMIN_PASSWORD` | A strong password, at least 8 characters. This becomes the admin login. |
| `CLIENT_ORIGINS` | Your Vercel address from step 4. Use `https://placeholder.example` for now. |
| `RAZORPAY_KEY_ID` | `rzp_test_...` from step 2 |
| `RAZORPAY_KEY_SECRET` | From step 2 |
| `RAZORPAY_WEBHOOK_SECRET` | Make up a long random text. You paste the same text into Razorpay next. |

`JWT_SECRET` is generated for you. `ADMIN_USERNAME` is `admin` unless you change it.

4. When the deploy finishes, open `https://<your-service>.onrender.com/api/health`. You should see `{"ok":true,"db":"mongodb",...}`. If it says `memory`, `MONGODB_URI` is missing.
5. **Razorpay > Account & Settings > Webhooks > Add new webhook**:
   - URL: `https://<your-service>.onrender.com/api/payments/webhook`
   - Secret: the same text as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `order.paid`, `payment.failed`

The webhook matters. If a resident pays and then closes the tab before the app confirms, the webhook still marks the bill paid.

The free Render plan sleeps after about 15 minutes without visits. The first request after that takes up to a minute, and the app shows a message while it waits. A paid Render plan removes this.

## 4. Vercel (website)

1. Vercel dashboard: **Add New > Project**, import the same repo. Leave the framework as **Other**. `vercel.json` already sets the build.
2. Add an environment variable **QS_API_URL** = `https://<your-service>.onrender.com` (no slash at the end).
3. Deploy. Vercel gives you an address like `https://queenstown-society.vercel.app`.
4. Go back to Render and set **CLIENT_ORIGINS** to that exact address. If you add your own domain later, list both, separated by a comma. Render restarts by itself.

QS_API_URL is read when the site is built. If you change it, redeploy on Vercel.

**Important:** if QS_API_URL is empty the site runs in demo mode and every phone or computer keeps its own copy. A logo changed on a laptop will then never appear on a phone. With QS_API_URL set, all devices read the same database.

Also add **QS_APK_URL** here (see ANDROID.md) to show the "Get the app" download button on the website.

## 5. First run

1. Open the Vercel address and sign in as `admin` with your `ADMIN_PASSWORD`.
2. **Society setup**: society name, monthly charges, due day and late fee.
3. **Site studio**: upload the logo, pick a festive theme and edit the footer. Use Preview, then Save changes.
4. Ask a resident to register a flat. Approve them under **Members**.
5. **Billing > Generate bills**.
6. Sign in as the resident, open **Maintenance** and press **Pay**. In Test Mode, Razorpay shows its own test page. Its documentation lists test card numbers and a test UPI ID. Choose the success option.
7. The bill turns **Paid** and a receipt appears. The admin sees it under Billing.

## How payment stays safe

- The browser never sets an amount. The server works out the bill total, including any late fee, and asks Razorpay for an order of exactly that amount.
- A bill is marked paid only after the server checks Razorpay's signature, or receives a signed webhook with the same amount.
- Your Key Secret and webhook secret live only on Render. They are never sent to the browser.
- If an admin already marked a bill paid in cash and the resident also paid online, the admin gets a notification to check for a refund.
- Residents can still report a bank transfer, cheque or cash payment. The admin verifies those by hand, as before.

## Android app

Set a **repository variable** named `QS_API_URL` (GitHub repo > Settings > Secrets and variables > Actions > Variables) to the same Render address, then run the **Build Android APK** workflow. See `ANDROID.md`.

## Run it on your own computer

```
cd server
ADMIN_PASSWORD=adminpass1 node server.js        # API on port 8080, data kept in memory
npm test                                         # 29 tests
```

In another terminal, from the repo root:

```
echo 'window.QS_API = "http://localhost:8080";' > config.js
python3 -m http.server 3000                      # open http://localhost:3000
```

With no `MONGODB_URI` the API keeps data in memory and forgets it when it stops. With no Razorpay keys, the Pay screen shows the manual UPI flow.
