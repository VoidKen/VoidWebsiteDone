-- Generated from the bot repo: every table the bot creates. Regenerate if the bot changes tables the dashboard reads.
CREATE TABLE IF NOT EXISTS guild_settings (
     guild_id   TEXT PRIMARY KEY,
     settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
CREATE TABLE IF NOT EXISTS warnings (
     id           SERIAL PRIMARY KEY,
     guild_id     TEXT NOT NULL,
     user_id      TEXT NOT NULL,
     moderator_id TEXT NOT NULL,
     reason       TEXT NOT NULL,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   );
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guild_id, user_id);
CREATE TABLE IF NOT EXISTS mod_events (
     id         SERIAL PRIMARY KEY,
     guild_id   TEXT NOT NULL,
     kind       TEXT NOT NULL,
     target_id  TEXT,
     actor_id   TEXT,
     reason     TEXT,
     details    JSONB NOT NULL DEFAULT '{}'::jsonb,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
CREATE INDEX IF NOT EXISTS idx_mod_events_guild_time ON mod_events (guild_id, created_at DESC);
CREATE TABLE IF NOT EXISTS bot_meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );
CREATE TABLE IF NOT EXISTS custom_commands (
     guild_id   TEXT NOT NULL,
     name       TEXT NOT NULL,
     response   TEXT NOT NULL,
     created_by TEXT,
     PRIMARY KEY (guild_id, name)
   );
CREATE TABLE IF NOT EXISTS giveaways (
     id          SERIAL PRIMARY KEY,
     guild_id    TEXT NOT NULL,
     channel_id  TEXT NOT NULL,
     message_id  TEXT,
     prize       TEXT NOT NULL,
     winner_count INTEGER NOT NULL DEFAULT 1,
     host_id     TEXT NOT NULL,
     end_at      TIMESTAMPTZ NOT NULL,
     ended       BOOLEAN NOT NULL DEFAULT false,
     winners     JSONB NOT NULL DEFAULT '[]'::jsonb
   );
CREATE UNIQUE INDEX IF NOT EXISTS idx_giveaways_message ON giveaways (message_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_due ON giveaways (ended, end_at);
CREATE TABLE IF NOT EXISTS giveaway_entries (
     giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
     user_id     TEXT NOT NULL,
     PRIMARY KEY (giveaway_id, user_id)
   );
CREATE TABLE IF NOT EXISTS tickets (
     id          SERIAL PRIMARY KEY,
     guild_id    TEXT NOT NULL,
     channel_id  TEXT NOT NULL UNIQUE,
     owner_id    TEXT NOT NULL,
     reason      TEXT,
     claimed_by  TEXT,
     priority    TEXT,
     control_message_id TEXT,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     closed_at   TIMESTAMPTZ,
     closed_by   TEXT
   );
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_one_open ON tickets (guild_id, owner_id) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS vip_cooldowns (
     user_id TEXT NOT NULL,
     key     TEXT NOT NULL,
     at      TIMESTAMPTZ NOT NULL,
     PRIMARY KEY (user_id, key)
   );
CREATE TABLE IF NOT EXISTS vip_tags (user_id TEXT PRIMARY KEY, tag TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vip_boosts (user_id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS vip_color_roles (
     guild_id TEXT NOT NULL, user_id TEXT NOT NULL, role_id TEXT NOT NULL,
     PRIMARY KEY (guild_id, user_id)
   );
CREATE TABLE IF NOT EXISTS vip_duels (
     id          SERIAL PRIMARY KEY,
     guild_id    TEXT NOT NULL,
     challenger  TEXT NOT NULL,
     opponent    TEXT NOT NULL,
     amount      INTEGER NOT NULL,
     status      TEXT NOT NULL DEFAULT 'pending',
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   );
CREATE TABLE IF NOT EXISTS levels_users (
     guild_id    TEXT NOT NULL,
     user_id     TEXT NOT NULL,
     xp          INTEGER NOT NULL DEFAULT 0,
     level       INTEGER NOT NULL DEFAULT 1,
     messages    INTEGER NOT NULL DEFAULT 0,
     last_xp_at  TIMESTAMPTZ,
     PRIMARY KEY (guild_id, user_id)
   );
CREATE INDEX IF NOT EXISTS idx_levels_users_rank ON levels_users (guild_id, level DESC, xp DESC);
CREATE TABLE IF NOT EXISTS wheel_saved (
     guild_id TEXT NOT NULL,
     name     TEXT NOT NULL,
     type     TEXT NOT NULL,
     data     JSONB NOT NULL DEFAULT '{}'::jsonb,
     PRIMARY KEY (guild_id, name)
   );
CREATE TABLE IF NOT EXISTS reaction_roles (
     guild_id   TEXT NOT NULL,
     message_id TEXT NOT NULL,
     emoji      TEXT NOT NULL,
     role_id    TEXT NOT NULL,
     PRIMARY KEY (guild_id, message_id, emoji)
   );
CREATE TABLE IF NOT EXISTS utility_reminders (
     id          SERIAL PRIMARY KEY,
     user_id     TEXT NOT NULL,
     guild_id    TEXT,
     channel_id  TEXT,
     message     TEXT NOT NULL,
     due_at      TIMESTAMPTZ NOT NULL,
     done        BOOLEAN NOT NULL DEFAULT false
   );
CREATE INDEX IF NOT EXISTS idx_reminders_due ON utility_reminders (done, due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON utility_reminders (user_id, done);
CREATE TABLE IF NOT EXISTS utility_birthdays (
     user_id  TEXT PRIMARY KEY,
     birthday TEXT NOT NULL
   );
CREATE TABLE IF NOT EXISTS bot_guilds (
     guild_id     TEXT PRIMARY KEY,
     name         TEXT NOT NULL,
     icon         TEXT,
     owner_id     TEXT,
     member_count INTEGER,
     channels     JSONB NOT NULL DEFAULT '[]'::jsonb,
     roles        JSONB NOT NULL DEFAULT '[]'::jsonb,
     updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   );
