// Requires the Vercel Postgres (Neon) integration to be connected to this
// project — that automatically sets POSTGRES_URL and friends as env vars,
// which @vercel/postgres reads on its own.
const { sql } = require('@vercel/postgres');

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS grants (
      id SERIAL PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'stripe',
      stripe_session_id TEXT,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_grants_discord_user_id
    ON grants (discord_user_id);
  `;
  schemaReady = true;
}

module.exports = { sql, ensureSchema };
