// Describes which bot settings the dashboard may edit, and checks every value on the SERVER before it is saved.
// The browser is never trusted: these checks are what stop a bad request from writing nonsense into the bot's settings.
//
// Keep the shapes in step with DEFAULTS in the bot's src/lib/settings.js (the bot publishes its real defaults
// into bot_meta so the dashboard always shows true values; this file only decides what may be written).

const SNOWFLAKE = /^\d{15,25}$/;

class ValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.path = path;
    this.userMessage = `${path}: ${message}`;
  }
}

const bool = () => ({ t: 'bool' });
const int = (min, max) => ({ t: 'int', min, max });
const oneOf = (...values) => ({ t: 'enum', values });
const text = (max, pattern) => ({ t: 'str', max, pattern });
const id = (kind) => ({ t: 'id', kind });
const ids = (kind, max) => ({ t: 'ids', kind, max });
const words = (maxItems, maxLen) => ({ t: 'strs', maxItems, maxLen });
const obj = (fields) => ({ t: 'obj', fields });

// level: who may edit it. 'admin' = Administrator/owner, 'manage' = Manage Server (matches the bot's slash commands).
const SECTIONS = {
  antinuke: {
    level: 'admin',
    schema: obj({
      enabled: bool(),
      punishment: oneOf('ban', 'kick', 'strip'),
      windowSeconds: int(3, 120),
      limits: obj({
        channelDelete: int(0, 50), channelCreate: int(0, 50), roleDelete: int(0, 50), roleCreate: int(0, 50),
        ban: int(0, 50), kick: int(0, 50), webhookCreate: int(0, 50), emojiDelete: int(0, 50), botAdd: int(0, 50),
      }),
      whitelist: ids('user', 50),
      restoreChannels: bool(),
      dmOwner: bool(),
    }),
  },
  automod: {
    level: 'manage',
    schema: obj({
      enabled: bool(),
      ignoredChannels: ids('channel', 100),
      ignoredRoles: ids('role', 100),
      bannedWords: words(200, 50),
      bannedLinks: words(100, 100),
      blockInvites: bool(),
      mentionLimit: int(0, 50),
      spam: obj({ enabled: bool(), messages: int(2, 50), seconds: int(1, 60) }),
      duplicates: obj({ enabled: bool(), count: int(2, 20), seconds: int(5, 300) }),
      caps: obj({ enabled: bool(), minLength: int(5, 200), percent: int(30, 100) }),
      strikes: obj({ timeoutAt: int(1, 20), windowMinutes: int(1, 1440), timeoutMinutes: int(1, 40320) }),
    }),
  },
  antialt: {
    level: 'admin',
    schema: obj({ enabled: bool(), thresholdDays: int(1, 365), action: oneOf('kick', 'alert'), logChannelId: id('channel') }),
  },
  levels: {
    level: 'manage',
    schema: obj({ enabled: bool(), xpPerMessage: int(1, 100), cooldownSeconds: int(0, 3600), announce: bool(), announceChannelId: id('channel') }),
  },
  tickets: {
    level: 'manage',
    schema: obj({
      supportRoleIds: ids('role', 25),
      notifyRoleIds: ids('role', 25),
      message: text(1500),
      categoryName: text(100),
      channelPrefix: text(20, /^[a-z0-9_-]*$/),
      logChannelId: id('channel'),
    }),
  },
  // The dashboard shows these three together; they live in different keys of the stored settings.
  logging: {
    level: 'admin',
    schema: obj({ modlogChannelId: id('channel'), serverlogChannelId: id('channel'), joinRoleId: id('role') }),
    toPatch: (v) => ({ modlogChannelId: v.modlogChannelId, serverlog: { channelId: v.serverlogChannelId }, joinRole: { roleId: v.joinRoleId } }),
    fromSettings: (s) => ({ modlogChannelId: s.modlogChannelId ?? null, serverlogChannelId: s.serverlog?.channelId ?? null, joinRoleId: s.joinRole?.roleId ?? null }),
  },
};

const LEVEL_RANK = { manage: 1, admin: 2 };
const atLeast = (userLevel, needed) => (LEVEL_RANK[userLevel] ?? 0) >= LEVEL_RANK[needed];
const canEditSection = (name, userLevel) => Boolean(SECTIONS[name]) && (LEVEL_RANK[userLevel] ?? 0) >= LEVEL_RANK[SECTIONS[name].level];

function check(node, value, path, ctx) {
  switch (node.t) {
    case 'bool':
      if (typeof value !== 'boolean') throw new ValidationError(path, 'must be true or false');
      return value;
    case 'int':
      if (!Number.isInteger(value) || value < node.min || value > node.max) throw new ValidationError(path, `must be a whole number from ${node.min} to ${node.max}`);
      return value;
    case 'enum':
      if (!node.values.includes(value)) throw new ValidationError(path, `must be one of ${node.values.join(', ')}`);
      return value;
    case 'str': {
      if (typeof value !== 'string') throw new ValidationError(path, 'must be text');
      const s = value.trim();
      if (s.length > node.max) throw new ValidationError(path, `must be at most ${node.max} characters`);
      if (node.pattern && !node.pattern.test(s)) throw new ValidationError(path, 'contains characters that are not allowed');
      return s;
    }
    case 'id':
      if (value === null) return null;
      return checkId(node.kind, value, path, ctx);
    case 'ids': {
      if (!Array.isArray(value)) throw new ValidationError(path, 'must be a list');
      if (value.length > node.max) throw new ValidationError(path, `can have at most ${node.max} entries`);
      return [...new Set(value.map((v, i) => checkId(node.kind, v, `${path}[${i}]`, ctx)))];
    }
    case 'strs': {
      if (!Array.isArray(value)) throw new ValidationError(path, 'must be a list');
      const seen = new Set(); const out = [];
      for (const [i, raw] of value.entries()) {
        if (typeof raw !== 'string') throw new ValidationError(`${path}[${i}]`, 'must be text');
        const s = raw.trim();
        if (!s) continue;
        if (s.length > node.maxLen) throw new ValidationError(`${path}[${i}]`, `must be at most ${node.maxLen} characters`);
        if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
      }
      if (out.length > node.maxItems) throw new ValidationError(path, `can have at most ${node.maxItems} entries`);
      return out;
    }
    case 'obj': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError(path, 'must be an object');
      for (const key of Object.keys(value)) if (!(key in node.fields)) throw new ValidationError(`${path}.${key}`, 'is not a setting');
      const out = {};
      for (const [key, child] of Object.entries(node.fields)) {
        if (!(key in value)) throw new ValidationError(`${path}.${key}`, 'is missing');
        out[key] = check(child, value[key], `${path}.${key}`, ctx);
      }
      return out;
    }
    default:
      throw new Error(`unknown schema type ${node.t}`);
  }
}

// Channels and roles must belong to this server (the bot publishes its lists); users can be any real-looking ID.
// An ID the bot hasn't published yet is still accepted if it is already stored, so a stale list never blocks a save.
function checkId(kind, value, path, ctx) {
  if (typeof value !== 'string' || !SNOWFLAKE.test(value)) throw new ValidationError(path, 'must be a Discord ID');
  if (kind === 'channel' && !ctx.channels.has(value) && !ctx.existing.has(value)) throw new ValidationError(path, 'is not a channel in this server');
  if (kind === 'role' && !ctx.roles.has(value) && !ctx.existing.has(value)) throw new ValidationError(path, 'is not a role in this server');
  return value;
}

/** Returns { value, patch } (patch is what gets merged into the stored settings) or throws ValidationError. */
function validateSection(name, input, ctx) {
  const section = SECTIONS[name];
  if (!section) throw new ValidationError('section', 'is not an editable section');
  const value = check(section.schema, input, name, ctx);
  return { value, patch: section.toPatch ? section.toPatch(value) : { [name]: value } };
}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function merge(base, override) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isPlain(override)) return out;
  for (const [k, v] of Object.entries(override)) out[k] = isPlain(v) && isPlain(base?.[k]) ? merge(base[k], v) : v;
  return out;
}

/** What one section looks like right now (stored values over the bot's defaults), in the shape the form edits. */
function sectionValue(name, defaults, stored) {
  const full = merge(defaults, stored || {});
  const value = SECTIONS[name].fromSettings ? SECTIONS[name].fromSettings(full) : full[name];
  return structuredClone(value); // never hand out objects shared with the defaults
}

/** Every ID mentioned in the stored settings, so those stay savable even if the published lists are stale. */
function collectIds(stored) {
  const out = new Set();
  (function walk(v) {
    if (typeof v === 'string' && SNOWFLAKE.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isPlain(v)) Object.values(v).forEach(walk);
  })(stored || {});
  return out;
}

module.exports = { atLeast, SECTIONS, ValidationError, validateSection, sectionValue, collectIds, canEditSection, merge, SNOWFLAKE };
