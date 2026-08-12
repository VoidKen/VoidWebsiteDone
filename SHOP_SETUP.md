# Shop Setup (Stripe)

Your `/shop` page takes card payments via **Stripe Checkout** and posts
a notification to Discord after every successful sale.

## How it works

- `src/data/products.js` — the list shown on the site. Edit names,
  prices, descriptions, stock, and images here.
- `api/_products.js` — a **server-side copy** of the same products.
  The server never trusts a price from the browser, so if you change a
  price or add a product, update **both files**.
- `api/create-checkout-session.js` — creates a Stripe Checkout Session
  for the chosen product and returns the URL to redirect to.
- `api/stripe-webhook.js` — Stripe calls this after a payment
  completes. It verifies the request really came from Stripe, then
  posts to Discord. This is the source of truth for "did they actually
  pay" — never the browser redirect, since a closed tab or flaky
  connection can't be trusted to fire.
- `api/_discord.js` — posts an embed to your Discord webhook (buyer
  name/email, product, price, Stripe session ID).

**Where the money goes:** into your **Stripe balance**, which Stripe
then pays out to a bank account on whatever schedule you set in the
Stripe Dashboard. Stripe does not pay out to PayPal.

## 1. Get Stripe API keys

1. Go to https://dashboard.stripe.com/register and create an account
   (or log into an existing one).
2. In the Dashboard, toggle **Test mode** on while you're setting up.
3. Go to Developers → API keys, copy the **Secret key** (`sk_test_...`).

## 2. Set up the webhook

1. Go to Developers → Webhooks → **Add endpoint**.
2. Endpoint URL: `https://your-domain.vercel.app/api/stripe-webhook`
3. Select the event: `checkout.session.completed`.
4. After creating it, copy the **Signing secret** (`whsec_...`).

## 3. Create a Discord webhook

1. In your Discord server: Server Settings → Integrations → Webhooks →
   New Webhook.
2. Pick the channel for order notifications, copy the **Webhook URL**.

## 4. Set environment variables in Vercel

In your Vercel project: Settings → Environment Variables, add:

| Name | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | your Stripe secret key | starts `sk_test_` or `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | your webhook signing secret | starts `whsec_` |
| `DISCORD_WEBHOOK_URL` | your Discord webhook URL | |

Redeploy after adding/changing env vars — Vercel doesn't hot-reload them.

## 5. Test it

1. With your **test mode** keys in place, buy something on your live
   Vercel URL and pay with Stripe's test card: `4242 4242 4242 4242`,
   any future expiry, any CVC.
2. Confirm you land back on `/shop?success=1` and the Discord message
   shows up.
3. When ready for real money: in Stripe, toggle off Test mode, repeat
   steps 1–2 with your **live** secret key and a **live** webhook
   endpoint (webhook secrets are different between test and live),
   update the Vercel env vars, redeploy.

## Local development

```
cp .env.example .env
npm install
npm start
```

`vercel dev` (instead of `npm start`) is needed if you want to test the
`/api` routes locally too — plain `npm start` only serves the React app.
For local webhook testing, use the Stripe CLI: `stripe listen --forward-to
localhost:3000/api/stripe-webhook`.
