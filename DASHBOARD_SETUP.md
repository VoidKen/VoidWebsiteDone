# Bot Dashboard Setup

Adds `/dashboard` to the site: log in with Discord, pick a server you manage, and edit VoidBot's settings
(anti-nuke, automod, anti-alt, levels, tickets, logging and join role) plus a read-only activity log.

## How it works

- The **bot** (Node.js version) publishes what the site needs into the shared Postgres database:
  `bot_guilds` (servers, text channels, roles) and `bot_meta.settings_defaults` (its default settings).
  So the website never needs the bot token. **Do not put the bot token on Vercel.**
- The **site** reads and writes the bot's `guild_settings` table. The bot picks changes up within
  `SETTINGS_CACHE_SECONDS` (30 s by default).
- Every dashboard save is recorded in the bot's `mod_events` table (kind `dashboard_settings`), so it shows in the Activity tab.

## Who can change what

| Section | Needs (in that Discord server) |
|---|---|
| Anti-nuke, Anti-alt, Logging & roles | Administrator (or server owner) |
| Automod, Levels, Tickets | Manage Server |

People with Manage Server see the admin sections read-only. The site owner (`ADMIN_DISCORD_ID`) can open any server the bot is in.
This mirrors the bot's own slash-command permissions, so the dashboard can't be used to get around them.

## Files added or changed

- `api/dashboard.js`: the whole dashboard API in ONE function (`?r=guilds | guild | settings | activity`).
  Vercel's free plan allows 12 functions per project and the site is now exactly at 12, so any new API route must be folded into an existing one.
- `api/_guildSettings.js`: which settings can be edited and the server-side checks on every value.
- `api/_dashboardData.js`: database queries. `api/_dashAuth.js`: the "which servers can this person manage" cookie.
- `api/auth/login.js` and `api/auth/callback.js`: dashboard logins also ask Discord for the server list (`guilds` scope).
  Normal shop logins are unchanged and still only ask for `identify`.
- `src/components/DashboardPage.js`, `GuildDashboard.js`, `src/dashboard/*`, `src/styles/dashboard.css`, routes in `src/App.js`, a "Bot Dashboard" item in the navbar menu.
- `test/` and `npm run test:api`: 14 tests against a real in-memory Postgres (`@electric-sql/pglite`, dev dependency only).

## Setup

1. Merge this branch and let Vercel deploy. **No new environment variables.** It uses the ones you already have
   (`SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `ADMIN_DISCORD_ID`, `POSTGRES_URL`).
2. **The site and the bot must use the same database.** `POSTGRES_URL` on Vercel and `DATABASE_URL` for the bot must point at the same Neon database/branch.
3. Start the bot once. On start it creates its tables and publishes its servers. Until then the dashboard says the bot hasn't published its settings yet.
4. Open `/dashboard`, log in. Discord shows a one-time prompt for the extra "see your servers" permission.

### Testing safely
If the bot uses a Neon *test branch*, point a Vercel **Preview** deployment at that same branch:
Vercel → Settings → Environment Variables → add `POSTGRES_URL` for **Preview only**. Then test on the preview URL.
Add that preview URL (`https://<preview>.vercel.app/api/auth/callback`) as an extra redirect in the Discord Developer Portal → OAuth2,
and set `DISCORD_REDIRECT_URI` for Preview to match. Leave Production alone until you're happy.

## Behaviour notes

- Permissions are re-checked with Discord at least hourly (automatic and silent if you've approved before). If you lose Manage Server, access ends within the hour.
- The Activity tab shows Discord IDs, not names (the site can't look names up without the bot token).
- If the bot changes its settings shape, keep `api/_guildSettings.js` in step. A test checks that the bot's real defaults pass the validator
  (`test/fixtures/defaults.json`, regenerated from the bot repo) so drift is caught.
