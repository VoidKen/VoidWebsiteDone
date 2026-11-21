// The whole dashboard API in ONE serverless function (Vercel's free plan allows only 12 functions per project,
// and the site already uses 11). Pick the action with ?r=guilds | guild | settings | activity.
const { getSessionFromRequest, isAdmin } = require('./_auth');
const { readDash, levelFor } = require('./_dashAuth');
const { ValidationError, SNOWFLAKE, atLeast } = require('./_guildSettings');

function createHandler({ data, community, auth = { getSessionFromRequest, isAdmin, readDash, levelFor } }) {
  const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });

  /** Browsers always send Origin on a cross-site POST, so requiring it to match our own host blocks CSRF. */
  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return false;
    try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
  }

  /** Checks every write must pass: same-site Origin (CSRF) and a JSON body. Returns [status, message] or null. */
  function postProblem(req) {
    if (!sameOrigin(req)) return [403, 'Bad origin.'];
    if (!String(req.headers['content-type'] || '').includes('application/json')) return [415, 'Send JSON.'];
    return null;
  }

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const route = String((req.query && req.query.r) || '');
    let ownerView = false; // the site owner also gets the real error text on a 500 (nobody else ever does)
    try {
      const session = auth.getSessionFromRequest(req);
      if (!session) return fail(res, 401, 'Log in with Discord first.', { login: true });
      const siteAdmin = auth.isAdmin(session);
      ownerView = siteAdmin;
      const levels = auth.readDash(req, session);
      if (!levels && !siteAdmin) return fail(res, 401, 'Your server permissions need refreshing.', { reauth: true });

      if (route === 'guilds' && req.method === 'GET') {
        return res.status(200).json({ guilds: await data.listGuilds({ levels, siteAdmin }) });
      }

      const guildId = String((req.query && req.query.g) || '');
      if (!SNOWFLAKE.test(guildId)) return fail(res, 400, 'Missing or invalid server.');
      const userLevel = auth.levelFor({ session, levels, guildId, isSiteAdmin: siteAdmin });
      if (!userLevel) return fail(res, 403, "You can't manage that server.");

      if (route === 'guild' && req.method === 'GET') {
        const bundle = await data.getGuildBundle(guildId, userLevel);
        if (bundle.error === 'not_found') return fail(res, 404, "VoidBot isn't in that server.");
        if (bundle.error === 'no_defaults') return fail(res, 503, "The bot hasn't published its settings yet. Start the bot once, then reload.");
        return res.status(200).json(bundle);
      }

      if (route === 'activity' && req.method === 'GET') {
        const result = await data.activity(guildId, String(req.query.type || ''), { before: req.query.before, kind: req.query.kind });
        if (!result) return fail(res, 400, 'Unknown activity type.');
        return res.status(200).json(result);
      }

      // Wheels (Manage Server, like the bot's Manage Messages gate but stricter) and custom commands (view: Manage Server, edit: Administrator, like the bot).
      if (['wheels', 'commands'].includes(route) && req.method === 'GET') {
        return route === 'wheels'
          ? res.status(200).json({ wheels: await community.listWheels(guildId), editable: atLeast(userLevel, 'manage') })
          : res.status(200).json({ commands: await community.listCommands(guildId), editable: atLeast(userLevel, 'admin') });
      }
      if (['wheel', 'command'].includes(route) && req.method === 'POST') {
        const bad = postProblem(req); if (bad) return fail(res, bad[0], bad[1]);
        const { action, ...input } = req.body || {};
        if (action !== 'save' && action !== 'delete') return fail(res, 400, 'Unknown action.');
        const needed = route === 'wheel' ? 'manage' : 'admin';
        if (!atLeast(userLevel, needed)) return fail(res, 403, needed === 'admin' ? 'Editing custom commands needs the Administrator permission.' : "You can't edit wheels here.");
        const actorId = session.id;
        const result = route === 'wheel'
          ? (action === 'save' ? await community.saveWheel({ guildId, input, actorId }) : await community.deleteWheel({ guildId, rawName: input.name, actorId }))
          : (action === 'save' ? await community.saveCommand({ guildId, rawName: input.name, response: input.response, actorId }) : await community.deleteCommand({ guildId, rawName: input.name, actorId }));
        if (result.error) return fail(res, result.error === 'missing' ? 404 : 409, result.message);
        return res.status(200).json({ ok: true, name: result.name });
      }

      if (route === 'settings' && req.method === 'POST') {
        const bad = postProblem(req); if (bad) return fail(res, bad[0], bad[1]);
        const { section, values } = req.body || {};
        if (typeof section !== 'string') return fail(res, 400, 'Missing section.');
        const result = await data.saveSection({ guildId, section, input: values, actorId: session.id, userLevel });
        if (result.error === 'forbidden') return fail(res, 403, section === 'antinuke' || section === 'antialt' || section === 'logging' ? 'That section needs the Administrator permission.' : "You can't edit that section.");
        if (result.error === 'not_found') return fail(res, 404, "VoidBot isn't in that server.");
        if (result.error === 'no_defaults') return fail(res, 503, "The bot hasn't published its settings yet.");
        return res.status(200).json({ ok: true, value: result.value, changed: result.changed });
      }

      return fail(res, route ? 405 : 400, 'Unknown request.');
    } catch (err) {
      if (err instanceof ValidationError) return fail(res, 400, err.userMessage);
      console.error('[dashboard]', err);
      return fail(res, 500, ownerView ? `Server error: ${String(err && (err.code ? `${err.code} ` : '') + (err && err.message)).slice(0, 300)}` : 'Server error.');
    }
  };
}

module.exports = (req, res) => {
  // Loaded lazily so tests can import createHandler without needing database environment variables.
  const { sql } = require('./_db');
  const { createData } = require('./_dashboardData');
  const { createCommunity } = require('./_communityData');
  module.exports._real = module.exports._real || createHandler({ data: createData(sql), community: createCommunity(sql) });
  return module.exports._real(req, res);
};
module.exports.createHandler = createHandler;
