// Wheels and custom commands. Same tables the bot uses (wheel_saved, custom_commands); same rules and limits as the bot's slash commands.
const { ValidationError } = require('./_guildSettings');
const { isMissingTable } = require('./_dashboardData');

const WHEEL_DEFAULT = 'default';
const MAX_WHEELS = 25;
const MAX_NAMES = 200;
const MAX_NAME_LEN = 100;
const MAX_COMMANDS = 100;
const COMMAND_NAME = /^[a-z0-9_-]{1,32}$/;
const MAX_RESPONSE = 1800;
const CONTROL = /[\p{C}]/u; // control, newline and other invisible characters
const asObject = (v) => (typeof v === 'string' ? JSON.parse(v) : v) || {};
const asArray = (v) => { const x = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(x) ? x : []; };

/** Same normalisation as the bot: trimmed, lowercase, empty means the default wheel. */
function wheelName(raw, path = 'name') {
  if (raw !== undefined && raw !== null && typeof raw !== 'string') throw new ValidationError(path, 'must be text');
  const n = String(raw ?? '').trim().toLowerCase() || WHEEL_DEFAULT;
  if (n.length > 50) throw new ValidationError(path, 'must be at most 50 characters');
  if (CONTROL.test(n)) throw new ValidationError(path, 'contains characters that are not allowed');
  return n;
}

function wheelNames(raw) {
  if (!Array.isArray(raw)) throw new ValidationError('names', 'must be a list');
  const seen = new Set(); const out = [];
  for (const [i, v] of raw.entries()) {
    if (typeof v !== 'string') throw new ValidationError(`names[${i}]`, 'must be text');
    const s = v.trim();
    if (!s) continue;
    if (s.length > MAX_NAME_LEN) throw new ValidationError(`names[${i}]`, `must be at most ${MAX_NAME_LEN} characters`);
    if (CONTROL.test(s)) throw new ValidationError(`names[${i}]`, 'contains characters that are not allowed');
    if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  if (!out.length) throw new ValidationError('names', 'needs at least one name');
  if (out.length > MAX_NAMES) throw new ValidationError('names', `can hold at most ${MAX_NAMES} names`);
  return out;
}

function commandName(raw) {
  if (typeof raw !== 'string') throw new ValidationError('name', 'must be text');
  const n = raw.trim().toLowerCase().replace(/^[!/]/, '');
  if (!COMMAND_NAME.test(n)) throw new ValidationError('name', 'can only use letters, numbers, - and _ (1 to 32 characters)');
  return n;
}

function createCommunity(sql) {
  async function botRoles(guildId) {
    try {
      const { rows } = await sql`SELECT roles FROM bot_guilds WHERE guild_id = ${guildId}`;
      return rows[0] ? asArray(rows[0].roles) : null;
    } catch (err) { if (isMissingTable(err)) return null; throw err; }
  }

  async function audit(guildId, kind, actorId, reason, details) {
    try {
      await sql`INSERT INTO mod_events (guild_id, kind, actor_id, reason, details) VALUES (${guildId}, ${kind}, ${actorId}, ${reason}, ${JSON.stringify(details)}::jsonb)`;
    } catch (err) { console.error('[dashboard] audit entry failed:', err.message); }
  }

  const safe = async (fn, fallback) => { try { return await fn(); } catch (err) { if (isMissingTable(err)) return fallback; throw err; } };

  // ── Wheels ──
  async function listWheels(guildId) {
    const rows = await safe(async () => (await sql`SELECT name, type, data FROM wheel_saved WHERE guild_id = ${guildId} ORDER BY name`).rows, []);
    return rows.map((r) => {
      const d = asObject(r.data);
      if (r.type === 'names') return { name: r.name, type: r.type, names: asArray(d.names) };
      if (r.type === 'role') return { name: r.name, type: r.type, roleId: d.role_id, roleName: d.role_name };
      return { name: r.name, type: r.type };
    });
  }

  async function saveWheel({ guildId, input, actorId }) {
    if (!input || typeof input !== 'object') throw new ValidationError('wheel', 'is missing');
    const name = wheelName(input.name);
    let type; let data;
    if (input.type === 'names') { type = 'names'; data = { names: wheelNames(input.names) }; }
    else if (input.type === 'all') { type = 'all'; data = {}; }
    else if (input.type === 'role') {
      const roles = await botRoles(guildId);
      const role = (roles || []).find((r) => r.id === input.roleId);
      if (!role) throw new ValidationError('roleId', 'is not a role in this server');
      type = 'role'; data = { role_id: role.id, role_name: role.name };
    } else throw new ValidationError('type', 'must be names, role or all');

    // One statement: the "at most 25 wheels" check and the write can't be split by another request.
    const { rows } = await sql`
      INSERT INTO wheel_saved (guild_id, name, type, data)
      SELECT ${guildId}, ${name}, ${type}, ${JSON.stringify(data)}::jsonb
      WHERE (SELECT COUNT(*) FROM wheel_saved WHERE guild_id = ${guildId} AND name <> ${name}) < ${MAX_WHEELS}
      ON CONFLICT (guild_id, name) DO UPDATE SET type = EXCLUDED.type, data = EXCLUDED.data
      RETURNING name`;
    if (!rows.length) return { error: 'limit', message: `A server can have at most ${MAX_WHEELS} saved wheels.` };
    await audit(guildId, 'dashboard_wheel', actorId, `Saved wheel "${name}" on the website dashboard`, { action: 'save', name, type });
    return { name };
  }

  async function deleteWheel({ guildId, rawName, actorId }) {
    const name = wheelName(rawName);
    const { rows } = await sql`DELETE FROM wheel_saved WHERE guild_id = ${guildId} AND name = ${name} RETURNING name`;
    if (!rows.length) return { error: 'missing', message: 'That wheel does not exist.' };
    await audit(guildId, 'dashboard_wheel', actorId, `Deleted wheel "${name}" on the website dashboard`, { action: 'delete', name });
    return { name };
  }

  // ── Custom commands ──
  async function listCommands(guildId) {
    const rows = await safe(async () => (await sql`SELECT name, response, created_by FROM custom_commands WHERE guild_id = ${guildId} ORDER BY name`).rows, []);
    return rows.map((r) => ({ name: r.name, response: r.response, createdBy: r.created_by }));
  }

  async function saveCommand({ guildId, rawName, response, actorId }) {
    const name = commandName(rawName);
    if (typeof response !== 'string') throw new ValidationError('response', 'must be text');
    const text = response.trim();
    if (!text) throw new ValidationError('response', 'cannot be empty');
    if (text.length > MAX_RESPONSE) throw new ValidationError('response', `must be at most ${MAX_RESPONSE} characters`);
    const { rows } = await sql`
      INSERT INTO custom_commands (guild_id, name, response, created_by)
      SELECT ${guildId}, ${name}, ${text}, ${actorId}
      WHERE (SELECT COUNT(*) FROM custom_commands WHERE guild_id = ${guildId} AND name <> ${name}) < ${MAX_COMMANDS}
      ON CONFLICT (guild_id, name) DO UPDATE SET response = EXCLUDED.response, created_by = EXCLUDED.created_by
      RETURNING name`;
    if (!rows.length) return { error: 'limit', message: `A server can have at most ${MAX_COMMANDS} custom commands.` };
    await audit(guildId, 'dashboard_command', actorId, `Saved custom command !${name} on the website dashboard`, { action: 'save', name });
    return { name };
  }

  async function deleteCommand({ guildId, rawName, actorId }) {
    const name = commandName(rawName);
    const { rows } = await sql`DELETE FROM custom_commands WHERE guild_id = ${guildId} AND name = ${name} RETURNING name`;
    if (!rows.length) return { error: 'missing', message: 'That command does not exist.' };
    await audit(guildId, 'dashboard_command', actorId, `Deleted custom command !${name} on the website dashboard`, { action: 'delete', name });
    return { name };
  }

  return { listWheels, saveWheel, deleteWheel, listCommands, saveCommand, deleteCommand };
}

module.exports = { createCommunity, MAX_WHEELS, MAX_NAMES, MAX_COMMANDS };
