// Database side of the dashboard. `sql` is injected (the real one is @vercel/postgres) so this can be tested
// against a real Postgres without touching the live database.
const { SECTIONS, validateSection, sectionValue, collectIds, canEditSection } = require('./_guildSettings');

const isMissingTable = (err) => Boolean(err) && (err.code === '42P01' || /relation .* does not exist/i.test(err.message || ''));
const asObject = (v) => (typeof v === 'string' ? JSON.parse(v) : v) || {};
const asArray = (v) => { const x = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(x) ? x : []; };

function createData(sql) {
  async function botGuilds(ids) {
    try {
      const filter = ids ? JSON.stringify(ids) : null;
      const { rows } = filter
        ? await sql`SELECT guild_id, name, icon, member_count FROM bot_guilds WHERE guild_id IN (SELECT jsonb_array_elements_text(${filter}::jsonb)) ORDER BY name`
        : await sql`SELECT guild_id, name, icon, member_count FROM bot_guilds ORDER BY name`;
      return rows;
    } catch (err) {
      if (isMissingTable(err)) return []; // the bot has not started against this database yet
      throw err;
    }
  }

  /** Servers the user may configure: the ones they manage (per Discord) that the bot is also in. */
  async function listGuilds({ levels, siteAdmin }) {
    const rows = await botGuilds(siteAdmin ? null : Object.keys(levels || {}));
    return rows.map((r) => ({ id: r.guild_id, name: r.name, icon: r.icon, memberCount: r.member_count, level: siteAdmin ? 'admin' : levels[r.guild_id] }));
  }

  /** Keep only the servers (from a { id: level } map) that the bot is actually in. Keeps the cookie small and relevant. */
  async function intersectBotGuilds(levels) {
    const rows = await botGuilds(Object.keys(levels || {}));
    return Object.fromEntries(rows.map((r) => [r.guild_id, levels[r.guild_id]]));
  }

  async function loadGuildRow(guildId) {
    try {
      const { rows } = await sql`SELECT guild_id, name, icon, member_count, channels, roles FROM bot_guilds WHERE guild_id = ${guildId}`;
      return rows[0] || null;
    } catch (err) { if (isMissingTable(err)) return null; throw err; }
  }

  async function loadDefaults() {
    try {
      const { rows } = await sql`SELECT value FROM bot_meta WHERE key = 'settings_defaults'`;
      return rows[0] ? JSON.parse(rows[0].value) : null;
    } catch (err) { if (isMissingTable(err)) return null; throw err; }
  }

  async function loadStored(guildId) {
    try {
      const { rows } = await sql`SELECT settings FROM guild_settings WHERE guild_id = ${guildId}`;
      return rows[0] ? asObject(rows[0].settings) : {};
    } catch (err) { if (isMissingTable(err)) return {}; throw err; }
  }

  /** Everything the settings page needs, or null if the bot isn't in that server / hasn't published defaults. */
  async function getGuildBundle(guildId, userLevel) {
    const row = await loadGuildRow(guildId);
    if (!row) return { error: 'not_found' };
    const defaults = await loadDefaults();
    if (!defaults) return { error: 'no_defaults' };
    const stored = await loadStored(guildId);
    const sections = {};
    for (const name of Object.keys(SECTIONS)) {
      sections[name] = { value: sectionValue(name, defaults, stored), editable: canEditSection(name, userLevel), level: SECTIONS[name].level };
    }
    return {
      guild: { id: row.guild_id, name: row.name, icon: row.icon, memberCount: row.member_count, channels: asArray(row.channels), roles: asArray(row.roles) },
      level: userLevel, sections,
    };
  }

  /** Validate, merge into the stored settings in ONE statement, and leave an audit entry in the bot's mod log table. */
  async function saveSection({ guildId, section, input, actorId, userLevel }) {
    if (!canEditSection(section, userLevel)) return { error: 'forbidden' };
    const row = await loadGuildRow(guildId);
    if (!row) return { error: 'not_found' };
    const defaults = await loadDefaults();
    if (!defaults) return { error: 'no_defaults' };
    const stored = await loadStored(guildId);
    const ctx = {
      channels: new Set(asArray(row.channels).map((c) => c.id)),
      roles: new Set(asArray(row.roles).map((r) => r.id)),
      existing: collectIds(stored),
    };
    const { value, patch } = validateSection(section, input, ctx); // throws ValidationError
    const before = sectionValue(section, defaults, stored);
    const patchJson = JSON.stringify(patch);
    // One-level merge: a section object is merged key-by-key into the stored one (so keys the bot or other pages wrote stay);
    // nested objects such as `limits` are replaced whole, because the form always sends them complete.
    const { rows } = await sql`
      INSERT INTO guild_settings (guild_id, settings, updated_at) VALUES (${guildId}, ${patchJson}::jsonb, now())
      ON CONFLICT (guild_id) DO UPDATE SET updated_at = now(), settings = guild_settings.settings || (
        SELECT COALESCE(jsonb_object_agg(e.key, CASE
          WHEN jsonb_typeof(e.value) = 'object' AND jsonb_typeof(guild_settings.settings -> e.key) = 'object'
          THEN (guild_settings.settings -> e.key) || e.value ELSE e.value END), '{}'::jsonb)
        FROM jsonb_each(${patchJson}::jsonb) AS e)
      RETURNING settings`;
    const saved = asObject(rows[0].settings);
    const changedKeys = Object.keys(value).filter((k) => JSON.stringify(value[k]) !== JSON.stringify(before?.[k]));
    try {
      await sql`INSERT INTO mod_events (guild_id, kind, actor_id, reason, details)
        VALUES (${guildId}, 'dashboard_settings', ${actorId}, ${`Changed ${section} settings on the website dashboard`}, ${JSON.stringify({ section, changed: changedKeys })}::jsonb)`;
    } catch (err) { console.error('[dashboard] audit entry failed:', err.message); }
    return { value: sectionValue(section, defaults, saved), changed: changedKeys };
  }

  const clampLimit = (n) => Math.min(Math.max(Number(n) || 50, 1), 100);
  const cursor = (v) => (/^\d{1,12}$/.test(String(v ?? '')) ? Number(v) : null);

  async function safeRows(promiseFn) {
    try { return (await promiseFn()).rows; } catch (err) { if (isMissingTable(err)) return []; throw err; }
  }

  /** Read-only activity feeds for one server. `before` is the id of the last row of the previous page. */
  async function activity(guildId, type, { before, kind, limit } = {}) {
    const lim = clampLimit(limit); const cur = cursor(before);
    if (type === 'events') {
      const k = /^[a-z0-9_:-]{1,40}$/i.test(kind || '') ? kind : null;
      const rows = await safeRows(() => sql`
        SELECT id, kind, target_id, actor_id, reason, details, created_at FROM mod_events
        WHERE guild_id = ${guildId} AND (${cur}::int IS NULL OR id < ${cur}::int) AND (${k}::text IS NULL OR kind = ${k}::text)
        ORDER BY id DESC LIMIT ${lim}`);
      return { items: rows.map((r) => ({ id: r.id, kind: r.kind, targetId: r.target_id, actorId: r.actor_id, reason: r.reason, details: asObject(r.details), at: r.created_at })) };
    }
    if (type === 'warnings') {
      const rows = await safeRows(() => sql`
        SELECT id, user_id, moderator_id, reason, created_at FROM warnings
        WHERE guild_id = ${guildId} AND (${cur}::int IS NULL OR id < ${cur}::int) ORDER BY id DESC LIMIT ${lim}`);
      return { items: rows.map((r) => ({ id: r.id, userId: r.user_id, moderatorId: r.moderator_id, reason: r.reason, at: r.created_at })) };
    }
    if (type === 'tickets') {
      const rows = await safeRows(() => sql`
        SELECT id, channel_id, owner_id, reason, claimed_by, priority, created_at, closed_at, closed_by FROM tickets
        WHERE guild_id = ${guildId} AND (${cur}::int IS NULL OR id < ${cur}::int) ORDER BY id DESC LIMIT ${lim}`);
      return { items: rows.map((r) => ({ id: r.id, channelId: r.channel_id, ownerId: r.owner_id, reason: r.reason, claimedBy: r.claimed_by, priority: r.priority, at: r.created_at, closedAt: r.closed_at, closedBy: r.closed_by, open: !r.closed_at })) };
    }
    return null;
  }

  return { listGuilds, intersectBotGuilds, getGuildBundle, saveSection, activity };
}

module.exports = { createData, isMissingTable };
