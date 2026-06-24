# Online Fee Payments (Paystack) — Setup

Parents/admins can now pay a fee line online (card, bank transfer, USSD). The
payment is **verified server-side**, **posted to the student's ledger** (reusing
the hardened `recordPayment`, so no double-posting), and — when it clears the
fees — **auto-releases the student's result PIN**.

## 1. Get your Paystack keys (free, test mode first)

1. Create an account at https://dashboard.paystack.com (use **Test Mode** to start).
2. **Settings → API Keys & Webhooks** → copy the **Secret Key** (`sk_test_…`).

## 2. Configure the backend

Add to `backend/.env` (never commit it):

```
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
```

Restart the backend (`npm run dev`). If the key is missing, the "Pay online"
button returns a clear "not configured" message instead of breaking anything.

## 3. (Production) Register the webhook

For reliable, hands-off reconciliation in production:

- **Settings → API Keys & Webhooks → Webhook URL:**
  ```
  https://YOUR-BACKEND-DOMAIN/api/paystack/webhook
  ```
- The endpoint verifies Paystack's `x-paystack-signature` (HMAC-SHA512) and
  posts the payment automatically — even if the payer closes the browser.

In **local dev** you can't receive webhooks on `localhost`, so use the
**"Verify payment"** button in the app (see below), which confirms the payment
on demand. (Or expose your backend with a tunnel and point the webhook at it.)

## 4. How it works in the app

Admin → **Finance → Ledgers** → expand a student → on any owing fee line click
**Pay**:

1. Enter the **payer's email** (for the Paystack receipt) and amount.
2. Click **"Pay online (Card / Transfer / USSD)"** → a Paystack checkout opens in
   a new tab.
3. After paying, return to the app tab and click **"Verify payment"** → the
   ledger updates and the result PIN releases if fees are now cleared.

In production the webhook does step 3 automatically.

## 5. Test it (Test Mode)

Use Paystack's test card at checkout:

- Card: `4084 0840 8408 4081`
- Expiry: any future date · CVV: `408` · PIN: `0000` · OTP: `123456`

You'll see the payment land on the ledger as method **online** with the Paystack
reference, and the collection figures (and your consolidated group earnings)
update live.

## Notes

- Amounts are sent to Paystack in **kobo** (naira × 100) and converted back on
  verification.
- Idempotent: the Paystack `reference` is used as the payment's `clientRef`, so
  the webhook and the "Verify" button can both fire without double-charging.
- Switch to **Live keys** (`sk_live_…`) only after testing; live mode requires a
  completed Paystack business profile.
