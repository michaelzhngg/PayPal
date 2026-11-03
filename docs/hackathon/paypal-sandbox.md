# PayPal sandbox

How Reclaim Pay's PayPal sandbox is set up, and how to show money arriving during the demo. No secrets in this file: keys live in the password manager and in Render.

## Accounts

| Account | Type | Role |
|---|---|---|
| Reclaim Pay Business | Sandbox Business (Malaysia) | Sends payouts and invoices. Must be funded. |
| Personal #1 | Sandbox Personal | Receives payouts for `employee@example.com` |
| Personal #2 | Sandbox Personal | Receives payouts for `employee2@example.com` |

The payer ID of each personal account goes into `DEMO_PAYER_ID_1..3` for the seed.

## One-time setup (developer.paypal.com)

1. **App.** Apps & Credentials → Sandbox → Create App (type: Merchant), linked to the business account. Copy the client ID and secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
2. **Accounts.** Testing Tools → Sandbox Accounts: create the business account and two personal accounts, country Malaysia. Fund the business account.
3. **Log in with PayPal.** In the app's settings, enable "Log in with PayPal":
   - Return URL: `{BACKEND_PUBLIC_URL}/api/v1/paypal/callback`
   - Attributes: email, PayPal account ID (payer ID), account verification status
   - Until staging exists, use a tunnel: `cloudflared tunnel --url http://localhost:8000`, and set `BACKEND_PUBLIC_URL` to the tunnel URL.
4. **Webhook.** In the app, add a webhook at `{BACKEND_PUBLIC_URL}/api/v1/paypal/webhook` for `PAYMENT.PAYOUTS-ITEM.*`, `PAYMENT.PAYOUTSBATCH.*` and `INVOICING.INVOICE.PAID`. Copy the webhook ID into `PAYPAL_WEBHOOK_ID`.
5. **Prove a payout by hand** before relying on the code:

   ```bash
   TOKEN=$(curl -s -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" \
     -d grant_type=client_credentials https://api-m.sandbox.paypal.com/v1/oauth2/token | jq -r .access_token)
   curl -s https://api-m.sandbox.paypal.com/v1/payments/payouts \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"sender_batch_header":{"sender_batch_id":"RC-spike-1"},
          "items":[{"recipient_type":"EMAIL","receiver":"<personal #1 sandbox email>",
                    "amount":{"value":"1.00","currency":"MYR"},"note":"spike"}]}'
   ```

   The spike pays the sandbox email because the payer ID isn't known yet; the app itself only pays `PAYPAL_ID`. If MYR is refused, set `PAYPAL_CURRENCY=USD` and tell the team.

## Environment

| Variable | Local | Staging |
|---|---|---|
| `PAYPAL_MOCK_MODE` | `true` | `false` |
| `PAYPAL_BASE_URL` | `https://api-m.sandbox.paypal.com` | same |
| `PAYPAL_WEB_URL` | `https://www.sandbox.paypal.com` | same |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | only with a tunnel | Render dashboard |
| `PAYPAL_WEBHOOK_ID` | only with a tunnel | Render dashboard |
| `PAYPAL_CURRENCY` | `MYR` (or `USD` after the spike) | same |
| `BACKEND_PUBLIC_URL`, `FRONTEND_PUBLIC_URL` | `http://localhost:8000`, `http://localhost:3000` | staging URLs |

With `PAYPAL_MOCK_MODE=true` nothing calls PayPal: payouts reach SUCCEEDED 8 seconds after creation, and webhooks are accepted without a signature.

## Showing the money arrive

1. Open `https://www.sandbox.paypal.com` in a separate browser profile and log in as Personal #1.
2. Note the balance before S1.
3. After S1 is approved, refresh: the balance goes up by the claim amount, and the activity list shows the payout with the note `RC-xxxxxxxx`.
