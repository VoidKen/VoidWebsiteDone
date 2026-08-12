# Accounts & Admin Setup

People can now log in with Discord, see what they've bought on
`/account`, and download real files. You grant products (or fix a
missed purchase) from `/admin` — visible only to your own Discord
account.

## How it works

- `api/_auth.js` — signs a small JWT and stores it in an httpOnly
  cookie (`void_session`). That cookie **is** the login session —
  there's no separate session store.
- `api/auth/login.js` → redirects to Discord's OAuth screen.
- `api/auth/callback.js` → Discord sends the user back here with a
  code; this exchanges it for their Discord ID/username/avatar and
  sets the session cookie.
- `api/auth/me.js` → the frontend calls this to check "am I logged
  in, and am I the admin?"
- `api/_db.js` → connects to Postgres and creates a `grants` table on
  first use if it doesn't exist yet (`discord_user_id`, `product_id`,
  `source`, `granted_at`). This is the single record of who owns what.
- `api/create-checkout-session.js` now **requires** login, and stamps
  the Stripe session with the buyer's Discord ID
  (`client_reference_id`).
- `api/stripe-webhook.js` writes a `grants` row the moment Stripe
  confirms payment — this is what makes a purchase show up on
  `/account`.
- `api/my-products.js` → what the logged-in user owns.
- `api/download.js` → checks login **and** ownership (or that you're
  the admin) before streaming a file from the private `private-files/`
  folder. That folder is never publicly served — the only way to reach
  a file in it is through this endpoint.
- `api/admin/grant.js` / `api/admin/grants.js` → admin-only: grant a
  product to any Discord user ID, and list recent grants.

## 1. Create a Discord application (if you don't have one)

You may already have one for VoidBot — you can reuse the same
application for login, you just need its OAuth2 settings.

1. Go to https://discord.com/developers/applications
2. Select your app (or **New Application**).
3. Under **OAuth2 → General**, copy the **Client ID** and
   **Client Secret**.
4. Under **OAuth2 → Redirects**, add:
   `https://your-domain.vercel.app/api/auth/callback`
   (add `http://localhost:3000/api/auth/callback` too if you'll test
   locally with `vercel dev`)

## 2. Connect a database

1. In your Vercel project: **Storage** tab → **Create Database** →
   **Postgres** (this is Neon under the hood, free tier is fine).
2. Once connected, Vercel automatically sets `POSTGRES_URL` and
   related env vars for you — nothing to copy by hand.
3. The `grants` table creates itself the first time any `/api` route
   touches the database. `db/schema.sql` has the same statement if you
   ever want to run it manually in the Postgres query editor.

## 3. Find your Discord user ID

1. Discord → Settings → Advanced → turn on **Developer Mode**.
2. Right-click your own name anywhere → **Copy User ID**.
3. That's your `ADMIN_DISCORD_ID` — only this account can open `/admin`.

## 4. Set environment variables in Vercel

Settings → Environment Variables:

| Name | Value | Notes |
|---|---|---|
| `DISCORD_CLIENT_ID` | from step 1 | |
| `DISCORD_CLIENT_SECRET` | from step 1 | keep secret |
| `DISCORD_REDIRECT_URI` | `https://your-domain.vercel.app/api/auth/callback` | must exactly match what you added in step 1 |
| `SESSION_SECRET` | any long random string | generate with `openssl rand -hex 32` |
| `ADMIN_DISCORD_ID` | from step 3 | |

Redeploy after adding/changing env vars.

## 5. Add real files

Drop your actual files into `private-files/`, named to match the
`file` field in **both** `src/data/products.js` and `api/_products.js`
(keep those two in sync — the server never trusts the browser for
which file goes with which product). Products with `file: null` just
show as owned, with no download button (good for "open a ticket"
style services).

There's already a placeholder `voidsworld-1.20.1.jar` in there so you
can test the full purchase → download flow before swapping in a real
mod jar.

`vercel.json` tells Vercel to bundle `private-files/**` with the
download function — don't remove that or downloads will 404 in
production even though they work fine with `vercel dev` locally.

## 6. Test it

1. Log in with Discord on your live site.
2. Buy the test product with Stripe's test card (`4242 4242 4242 4242`).
3. Go to `/account` — it should show up with a working Download button.
4. Go to `/admin` (only works when logged in as `ADMIN_DISCORD_ID`) and
   try granting a product to a friend's Discord ID — have them log in
   and check `/account`.

## A note on security

`/api/download` checks the session cookie and the `grants` table on
every single request — there's no long-lived download link floating
around, so there's nothing to leak or expire. Admin routes check
`ADMIN_DISCORD_ID` server-side on every request too, not just in the
frontend, so someone can't fake admin access by editing JavaScript in
their browser.
