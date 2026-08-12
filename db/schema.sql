-- This runs automatically the first time any API route touches the
-- database, but you can also paste it into the Vercel Postgres
-- "Query" tab yourself if you want to check it worked.

CREATE TABLE IF NOT EXISTS grants (
  id SERIAL PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'stripe', -- 'stripe' (auto) or 'admin' (you granted it)
  stripe_session_id TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grants_discord_user_id ON grants (discord_user_id);
