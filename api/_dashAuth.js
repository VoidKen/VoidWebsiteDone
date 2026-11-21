// Dashboard access. The normal login only proves WHO you are. To know which servers you may manage, the dashboard
// login also asks Discord for your server list (the `guilds` scope), works out where you have Administrator or
// Manage Server, and keeps only servers the bot is in. That short-lived result lives in its own signed cookie.
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'void_dash';
const TTL_SECONDS = 60 * 60; // permissions are re-checked with Discord at least hourly

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

const secret = () => {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  return process.env.SESSION_SECRET;
};

/** From Discord's /users/@me/guilds: { id: 'admin' | 'manage' } for servers the user may configure. */
function manageLevels(userGuilds) {
  const out = {};
  for (const g of Array.isArray(userGuilds) ? userGuilds : []) {
    if (!g || typeof g.id !== 'string') continue;
    let perms = 0n;
    try { perms = BigInt(g.permissions ?? '0'); } catch { perms = 0n; }
    if (g.owner || (perms & ADMINISTRATOR) === ADMINISTRATOR) out[g.id] = 'admin';
    else if ((perms & MANAGE_GUILD) === MANAGE_GUILD) out[g.id] = 'manage';
  }
  return out;
}

function setDashCookie(res, userId, levels) {
  const token = jwt.sign({ sub: userId, g: levels }, secret(), { expiresIn: TTL_SECONDS });
  const serialized = cookie.serialize(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: TTL_SECONDS });
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', existing ? [].concat(existing, serialized) : serialized); // keep the session cookie that was just set
}

function clearDashCookie(res) {
  const serialized = cookie.serialize(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', existing ? [].concat(existing, serialized) : serialized);
}

/** The levels map, but only if the cookie is genuine, unexpired and belongs to the logged-in user. */
function readDash(req, session) {
  const token = cookie.parse(req.headers.cookie || '')[COOKIE_NAME];
  if (!token || !session) return null;
  try {
    const data = jwt.verify(token, secret());
    return data.sub === session.id ? data.g || {} : null;
  } catch { return null; }
}

/** 'admin' | 'manage' | null for this user in this server. The site owner (ADMIN_DISCORD_ID) is 'admin' everywhere. */
function levelFor({ session, levels, guildId, isSiteAdmin }) {
  if (!session) return null;
  if (isSiteAdmin) return 'admin';
  return levels?.[guildId] ?? null;
}

module.exports = { manageLevels, setDashCookie, clearDashCookie, readDash, levelFor, COOKIE_NAME, TTL_SECONDS };
