// Run with: npm run test:api   (real Postgres in memory via PGlite; nothing touches your live database)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { PGlite } = require('@electric-sql/pglite');

process.env.SESSION_SECRET = 'test-secret-test-secret';
process.env.ADMIN_DISCORD_ID = '900000000000000001';

const { manageLevels, setDashCookie, readDash } = require('../api/_dashAuth');
const { validateSection, ValidationError, sectionValue, collectIds, canEditSection, SECTIONS } = require('../api/_guildSettings');
const { createData } = require('../api/_dashboardData');
const { createHandler } = require('../api/dashboard');
const { getSessionFromRequest, isAdmin } = require('../api/_auth');
const defaults = require('./fixtures/defaults.json');

const G = '100000000000000001'; const G2 = '100000000000000002';
const CH1 = '200000000000000001'; const CH2 = '200000000000000002';
const R1 = '300000000000000001'; const R2 = '300000000000000002';
const U_ADMIN = '400000000000000001'; const U_MANAGE = '400000000000000002'; const U_OTHER = '400000000000000003';

function makeSql(pg) {
  const sql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    const r = await pg.query(text, values);
    return { rows: r.rows };
  };
  return sql;
}

async function freshDb({ schema = true, seed = true } = {}) {
  const pg = new PGlite();
  if (schema) await pg.exec(fs.readFileSync(path.join(__dirname, 'fixtures/botSchema.sql'), 'utf8'));
  if (schema && seed) {
    await pg.query("INSERT INTO bot_meta (key, value) VALUES ('settings_defaults', $1)", [JSON.stringify(defaults)]);
    await pg.query('INSERT INTO bot_guilds (guild_id, name, icon, channels, roles) VALUES ($1,$2,$3,$4,$5)', [G, 'Alpha', null, JSON.stringify([{ id: CH1, name: 'general' }, { id: CH2, name: 'logs' }]), JSON.stringify([{ id: R1, name: 'Mod', managed: false }, { id: R2, name: 'Support', managed: false }])]);
    await pg.query('INSERT INTO bot_guilds (guild_id, name) VALUES ($1,$2)', [G2, 'Beta']);
  }
  return { pg, sql: makeSql(pg) };
}

const sessionCookie = (id) => `void_session=${jwt.sign({ id, username: 'u', avatar: null }, process.env.SESSION_SECRET)}`;
const dashCookie = (sub, g, opts = {}) => `void_dash=${jwt.sign({ sub, g }, process.env.SESSION_SECRET, opts)}`;
const ctxAll = { channels: new Set([CH1, CH2]), roles: new Set([R1, R2]), existing: new Set() };

function call(handler, { method = 'GET', query = {}, cookies = [], headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); return this; } };
    const req = { method, query, headers: { host: 'site.test', cookie: cookies.join('; '), ...headers }, body };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
const post = (h, query, cookies, body, headers = {}) => call(h, { method: 'POST', query, cookies, body, headers: { origin: 'https://site.test', 'content-type': 'application/json', ...headers } });

// ───────────── permissions ─────────────
test('manageLevels: owner/Administrator = admin, Manage Server = manage, everything else dropped', () => {
  const out = manageLevels([
    { id: 'a', owner: true, permissions: '0' },
    { id: 'b', owner: false, permissions: String(0x8) },
    { id: 'c', owner: false, permissions: String(0x20) },
    { id: 'd', owner: false, permissions: String(0x10 | 0x4) }, // Manage Channels + Ban: not enough
    { id: 'e', owner: false, permissions: 'not a number' },
    { id: 'f', owner: false, permissions: '2251799813685247' }, // huge 64-bit value incl. Administrator
    null, { nope: 1 },
  ]);
  assert.deepEqual(out, { a: 'admin', b: 'admin', c: 'manage', f: 'admin' });
  assert.deepEqual(manageLevels(undefined), {});
});

test('dash cookie: genuine one is read back; another user\'s, a forged one and an expired one are rejected', () => {
  const res = { h: {}, getHeader(k) { return this.h[k]; }, setHeader(k, v) { this.h[k] = v; } };
  res.setHeader('Set-Cookie', 'void_session=abc');
  setDashCookie(res, U_ADMIN, { [G]: 'admin' });
  assert.equal(res.h['Set-Cookie'].length, 2, 'the session cookie is kept');
  const raw = res.h['Set-Cookie'][1].split(';')[0];
  const mk = (cookie) => ({ headers: { cookie } });
  assert.deepEqual(readDash(mk(raw), { id: U_ADMIN }), { [G]: 'admin' });
  assert.equal(readDash(mk(raw), { id: U_OTHER }), null);
  assert.equal(readDash(mk(raw.slice(0, -3) + 'xxx'), { id: U_ADMIN }), null);
  assert.equal(readDash(mk(dashCookie(U_ADMIN, { [G]: 'admin' }, { expiresIn: -10 })), { id: U_ADMIN }), null);
  assert.equal(readDash(mk(''), { id: U_ADMIN }), null);
  assert.equal(canEditSection('antinuke', 'manage'), false);
  assert.equal(canEditSection('automod', 'manage'), true);
  assert.equal(canEditSection('nope', 'admin'), false);
});

// ───────────── validation ─────────────
test('the bot\'s real default settings pass the dashboard validator (catches the two drifting apart)', () => {
  for (const name of Object.keys(SECTIONS)) {
    const value = sectionValue(name, defaults, {});
    const { value: out } = validateSection(name, structuredClone(value), ctxAll);
    assert.deepEqual(out, value, name);
  }
});

test('validation rejects bad types, ranges, unknown/missing keys, foreign channels', () => {
  const good = () => sectionValue('levels', defaults, {});
  const bad = (name, mut, re) => { const v = structuredClone(sectionValue(name, defaults, {})); mut(v); assert.throws(() => validateSection(name, v, ctxAll), (e) => e instanceof ValidationError && re.test(e.message), `${name} ${re}`); };
  bad('levels', (v) => { v.xpPerMessage = 1000; }, /xpPerMessage.*1 to 100/);
  bad('levels', (v) => { v.xpPerMessage = '10'; }, /whole number/);
  bad('levels', (v) => { v.xpPerMessage = 1.5; }, /whole number/);
  bad('levels', (v) => { v.enabled = 'yes'; }, /true or false/);
  bad('levels', (v) => { v.extra = 1; }, /extra.*not a setting/);
  bad('levels', (v) => { delete v.announce; }, /announce.*missing/);
  bad('levels', (v) => { v.announceChannelId = '999999999999999999'; }, /not a channel in this server/);
  bad('levels', (v) => { v.announceChannelId = 'abc'; }, /Discord ID/);
  bad('antinuke', (v) => { v.punishment = 'nuke'; }, /one of ban, kick, strip/);
  bad('antinuke', (v) => { v.limits.ban = -1; }, /limits\.ban/);
  bad('antinuke', (v) => { v.whitelist = ['1', '2']; }, /Discord ID/);
  bad('antinuke', (v) => { v.limits.__proto__ = 1; v.limits.hax = 1; }, /hax.*not a setting/);
  bad('automod', (v) => { v.bannedWords = Array.from({ length: 201 }, (_, i) => `w${i}`); }, /at most 200/);
  bad('automod', (v) => { v.bannedWords = ['x'.repeat(51)]; }, /at most 50/);
  bad('automod', (v) => { v.ignoredRoles = ['300000000000000009']; }, /not a role in this server/);
  bad('tickets', (v) => { v.channelPrefix = 'Bad Prefix!'; }, /not allowed/);
  bad('tickets', (v) => { v.message = 'x'.repeat(1501); }, /1500/);
  assert.throws(() => validateSection('nope', {}, ctxAll), /not an editable section/);
  assert.throws(() => validateSection('levels', null, ctxAll), /must be an object/);
  assert.throws(() => validateSection('levels', [], ctxAll), /must be an object/);
  assert.ok(good());
});

test('lists are trimmed and de-duplicated; stored IDs stay valid even if the published list is stale', () => {
  const v = sectionValue('automod', defaults, {});
  v.bannedWords = [' Spam ', 'spam', '', 'Scam'];
  v.ignoredChannels = [CH1, CH1];
  const { value } = validateSection('automod', v, ctxAll);
  assert.deepEqual(value.bannedWords, ['Spam', 'Scam']);
  assert.deepEqual(value.ignoredChannels, [CH1]);
  const stale = '200000000000000777';
  const lv = sectionValue('levels', defaults, {}); lv.announceChannelId = stale;
  assert.throws(() => validateSection('levels', lv, ctxAll));
  assert.ok(validateSection('levels', lv, { ...ctxAll, existing: collectIds({ levels: { announceChannelId: stale } }) }));
});

// ───────────── data layer against real Postgres ─────────────
test('getGuildBundle merges stored values over the bot defaults and flags what the user may edit', async () => {
  const { pg, sql } = await freshDb();
  await pg.query("INSERT INTO guild_settings (guild_id, settings) VALUES ($1, $2)", [G, JSON.stringify({ levels: { xpPerMessage: 25 }, modlogChannelId: CH2, joinRole: { roleId: R1 } })]);
  const data = createData(sql);
  const b = await data.getGuildBundle(G, 'manage');
  assert.equal(b.sections.levels.value.xpPerMessage, 25);
  assert.equal(b.sections.levels.value.cooldownSeconds, defaults.levels.cooldownSeconds, 'untouched keys come from the defaults');
  assert.deepEqual(b.sections.logging.value, { modlogChannelId: CH2, serverlogChannelId: null, joinRoleId: R1 });
  assert.equal(b.sections.levels.editable, true);
  assert.equal(b.sections.antinuke.editable, false);
  assert.equal(b.guild.channels.length, 2);
  assert.equal((await data.getGuildBundle('123456789012345678', 'admin')).error, 'not_found');
  await pg.query("DELETE FROM bot_meta");
  assert.equal((await data.getGuildBundle(G, 'admin')).error, 'no_defaults');
});

test('saveSection merges into stored settings (keeps keys it does not own), writes logging to three keys, and audits', async () => {
  const { pg, sql } = await freshDb();
  const data = createData(sql);
  await pg.query("INSERT INTO guild_settings (guild_id, settings) VALUES ($1, $2)", [G, JSON.stringify({ levels: { announceChannelId: CH1, futureKey: 'keep me' }, store: { title: 'Shop' }, antinuke: { whitelist: [U_OTHER] } })]);

  const lv = sectionValue('levels', defaults, { levels: { announceChannelId: CH1 } }); lv.xpPerMessage = 33;
  const r = await data.saveSection({ guildId: G, section: 'levels', input: lv, actorId: U_MANAGE, userLevel: 'manage' });
  assert.deepEqual(r.changed, ['xpPerMessage']);
  const stored = (await pg.query('SELECT settings FROM guild_settings WHERE guild_id=$1', [G])).rows[0].settings;
  assert.equal(stored.levels.xpPerMessage, 33);
  assert.equal(stored.levels.futureKey, 'keep me');
  assert.deepEqual(stored.store, { title: 'Shop' });
  assert.deepEqual(stored.antinuke.whitelist, [U_OTHER]);

  await data.saveSection({ guildId: G, section: 'logging', input: { modlogChannelId: CH2, serverlogChannelId: CH1, joinRoleId: R2 }, actorId: U_ADMIN, userLevel: 'admin' });
  const s2 = (await pg.query('SELECT settings FROM guild_settings WHERE guild_id=$1', [G])).rows[0].settings;
  assert.equal(s2.modlogChannelId, CH2); assert.equal(s2.serverlog.channelId, CH1); assert.equal(s2.joinRole.roleId, R2);
  assert.equal(s2.levels.xpPerMessage, 33, 'other sections untouched');

  const audit = (await pg.query("SELECT actor_id, details FROM mod_events WHERE kind='dashboard_settings' ORDER BY id")).rows;
  assert.equal(audit.length, 2);
  assert.equal(audit[0].actor_id, U_MANAGE);
  assert.deepEqual(audit[0].details, { section: 'levels', changed: ['xpPerMessage'] });
});

test('saveSection creates the row for a server with no stored settings yet', async () => {
  const { pg, sql } = await freshDb();
  const lv = sectionValue('levels', defaults, {}); lv.enabled = false;
  await createData(sql).saveSection({ guildId: G, section: 'levels', input: lv, actorId: U_MANAGE, userLevel: 'manage' });
  const stored = (await pg.query('SELECT settings FROM guild_settings WHERE guild_id=$1', [G])).rows[0].settings;
  assert.equal(stored.levels.enabled, false);
});

test('saveSection refuses a Manage-Server user on admin sections and writes nothing', async () => {
  const { pg, sql } = await freshDb();
  const an = sectionValue('antinuke', defaults, {}); an.whitelist = [U_MANAGE];
  const r = await createData(sql).saveSection({ guildId: G, section: 'antinuke', input: an, actorId: U_MANAGE, userLevel: 'manage' });
  assert.equal(r.error, 'forbidden');
  assert.equal((await pg.query('SELECT 1 FROM guild_settings')).rows.length, 0);
});

test('concurrent saves to different sections both survive', async () => {
  const { pg, sql } = await freshDb();
  const data = createData(sql);
  const a = sectionValue('levels', defaults, {}); a.xpPerMessage = 11;
  const b = sectionValue('automod', defaults, {}); b.mentionLimit = 9;
  await Promise.all([
    data.saveSection({ guildId: G, section: 'levels', input: a, actorId: U_MANAGE, userLevel: 'manage' }),
    data.saveSection({ guildId: G, section: 'automod', input: b, actorId: U_MANAGE, userLevel: 'manage' }),
  ]);
  const s = (await pg.query('SELECT settings FROM guild_settings WHERE guild_id=$1', [G])).rows[0].settings;
  assert.equal(s.levels.xpPerMessage, 11); assert.equal(s.automod.mentionLimit, 9);
});

test('activity feeds page correctly, filter by kind, and tolerate missing tables', async () => {
  const { pg, sql } = await freshDb();
  for (let i = 0; i < 5; i += 1) await pg.query("INSERT INTO mod_events (guild_id, kind, actor_id, reason) VALUES ($1, $2, 'a', $3)", [G, i % 2 ? 'warn' : 'ban', `r${i}`]);
  await pg.query("INSERT INTO mod_events (guild_id, kind) VALUES ($1, 'other-guild')", [G2]);
  await pg.query("INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES ($1,'u','m','be nice')", [G]);
  await pg.query("INSERT INTO tickets (guild_id, channel_id, owner_id) VALUES ($1,'c1','o1')", [G]);
  const data = createData(sql);
  const p1 = await data.activity(G, 'events', { limit: 2 });
  assert.deepEqual(p1.items.map((i) => i.reason), ['r4', 'r3']);
  const p2 = await data.activity(G, 'events', { limit: 2, before: p1.items.at(-1).id });
  assert.deepEqual(p2.items.map((i) => i.reason), ['r2', 'r1']);
  assert.deepEqual((await data.activity(G, 'events', { kind: 'warn' })).items.map((i) => i.reason), ['r3', 'r1']);
  assert.equal((await data.activity(G, 'events', { kind: "x'; DROP TABLE mod_events;--" })).items.length, 5, 'a hostile kind is ignored, not executed');
  assert.equal((await data.activity(G, 'warnings')).items[0].reason, 'be nice');
  assert.equal((await data.activity(G, 'tickets')).items[0].open, true);
  assert.equal(await data.activity(G, 'bogus'), null);
  const empty = await freshDb({ schema: false });
  const d2 = createData(empty.sql);
  assert.deepEqual((await d2.activity(G, 'events')).items, []);
  assert.deepEqual(await d2.listGuilds({ levels: { [G]: 'admin' }, siteAdmin: false }), []);
  assert.deepEqual(await d2.intersectBotGuilds({ [G]: 'admin' }), {});
  assert.equal((await d2.getGuildBundle(G, 'admin')).error, 'not_found');
});

test('listGuilds / intersectBotGuilds only return servers the bot is in', async () => {
  const { sql } = await freshDb();
  const data = createData(sql);
  const levels = { [G]: 'manage', '555555555555555555': 'admin' };
  assert.deepEqual(await data.intersectBotGuilds(levels), { [G]: 'manage' });
  assert.deepEqual((await data.listGuilds({ levels: { [G]: 'manage' }, siteAdmin: false })).map((g) => [g.id, g.level]), [[G, 'manage']]);
  assert.equal((await data.listGuilds({ levels: {}, siteAdmin: true })).length, 2, 'the site owner sees every server');
  assert.deepEqual(await data.listGuilds({ levels: {}, siteAdmin: false }), []);
});

// ───────────── HTTP handler ─────────────
test('handler: auth, permissions, CSRF, and the happy paths', async () => {
  const { pg, sql } = await freshDb();
  const h = createHandler({ data: createData(sql) });
  const admin = [sessionCookie(U_ADMIN), dashCookie(U_ADMIN, { [G]: 'admin' })];
  const manage = [sessionCookie(U_MANAGE), dashCookie(U_MANAGE, { [G]: 'manage' })];

  assert.equal((await call(h, { query: { r: 'guilds' } })).code, 401);
  const noDash = await call(h, { query: { r: 'guilds' }, cookies: [sessionCookie(U_ADMIN)] });
  assert.equal(noDash.code, 401); assert.equal(noDash.body.reauth, true);
  const stolen = await call(h, { query: { r: 'guilds' }, cookies: [sessionCookie(U_OTHER), dashCookie(U_ADMIN, { [G]: 'admin' })] });
  assert.equal(stolen.body.reauth, true, "someone else's dashboard cookie is useless");

  assert.deepEqual((await call(h, { query: { r: 'guilds' }, cookies: manage })).body.guilds.map((g) => g.id), [G]);
  assert.equal((await call(h, { query: { r: 'guild', g: G2 }, cookies: manage })).code, 403);
  assert.equal((await call(h, { query: { r: 'guild', g: 'nope' }, cookies: manage })).code, 400);
  const g = await call(h, { query: { r: 'guild', g: G }, cookies: manage });
  assert.equal(g.code, 200); assert.equal(g.body.sections.antinuke.editable, false);

  const lv = sectionValue('levels', defaults, {}); lv.cooldownSeconds = 5;
  assert.equal((await call(h, { method: 'POST', query: { r: 'settings', g: G }, cookies: manage, body: { section: 'levels', values: lv }, headers: { 'content-type': 'application/json' } })).code, 403, 'no Origin header');
  assert.equal((await post(h, { r: 'settings', g: G }, manage, { section: 'levels', values: lv }, { origin: 'https://evil.test' })).code, 403, 'foreign Origin');
  assert.equal((await post(h, { r: 'settings', g: G }, manage, { section: 'levels', values: lv }, { 'content-type': 'text/plain' })).code, 415);
  const okSave = await post(h, { r: 'settings', g: G }, manage, { section: 'levels', values: lv });
  assert.equal(okSave.code, 200); assert.equal(okSave.body.value.cooldownSeconds, 5);

  const an = sectionValue('antinuke', defaults, {});
  const denied = await post(h, { r: 'settings', g: G }, manage, { section: 'antinuke', values: an });
  assert.equal(denied.code, 403); assert.match(denied.body.error, /Administrator/);
  assert.equal((await post(h, { r: 'settings', g: G }, admin, { section: 'antinuke', values: an })).code, 200);

  const invalid = await post(h, { r: 'settings', g: G }, admin, { section: 'levels', values: { ...lv, xpPerMessage: 99999 } });
  assert.equal(invalid.code, 400); assert.match(invalid.body.error, /xpPerMessage/);
  assert.equal((await post(h, { r: 'settings', g: G }, admin, { values: lv })).code, 400);
  assert.equal((await post(h, { r: 'settings', g: G }, admin, { section: 'levels' })).code, 400);

  assert.equal((await call(h, { query: { r: 'activity', g: G, type: 'events' }, cookies: manage })).body.items[0].kind, 'dashboard_settings');
  assert.equal((await call(h, { query: { r: 'activity', g: G, type: 'x' }, cookies: manage })).code, 400);
  assert.equal((await call(h, { method: 'DELETE', query: { r: 'guild', g: G }, cookies: manage })).code, 405);
  assert.equal((await call(h, { query: { r: 'whatever', g: G }, cookies: manage })).code, 405);

  const owner = [sessionCookie(process.env.ADMIN_DISCORD_ID)];
  assert.equal((await call(h, { query: { r: 'guild', g: G2 }, cookies: owner })).code, 200, 'the site owner can open any server the bot is in');
  await pg.query('DELETE FROM bot_meta');
  assert.equal((await call(h, { query: { r: 'guild', g: G }, cookies: admin })).code, 503);
});

test('handler never leaks internals on unexpected errors', async () => {
  const h = createHandler({ data: { listGuilds: async () => { throw new Error('password=hunter2 connection refused'); } } });
  const r = await call(h, { query: { r: 'guilds' }, cookies: [sessionCookie(U_ADMIN), dashCookie(U_ADMIN, {})] });
  assert.equal(r.code, 500); assert.equal(r.body.error, 'Server error.');
  assert.ok(!JSON.stringify(r.body).includes('hunter2'));
  const owner = await call(h, { query: { r: 'guilds' }, cookies: [sessionCookie(process.env.ADMIN_DISCORD_ID)] });
  assert.match(owner.body.error, /connection refused/, 'only the site owner sees the cause');
  assert.ok(getSessionFromRequest && isAdmin);
});

// ───────────── wheels and custom commands ─────────────
const { createCommunity } = require('../api/_communityData');

test('wheels: save names/role/all, replace, list, delete, validate, and enforce the 25 limit', async () => {
  const { pg, sql } = await freshDb();
  const c = createCommunity(sql);
  const save = (input) => c.saveWheel({ guildId: G, input, actorId: U_MANAGE });

  await save({ name: ' Lunch Spots ', type: 'names', names: ['Pizza', ' pizza ', 'Tacos', ''] });
  await save({ name: '', type: 'all' });
  await save({ name: 'mods', type: 'role', roleId: R1 });
  let list = await c.listWheels(G);
  assert.deepEqual(list.map((w) => w.name), ['default', 'lunch spots', 'mods']);
  assert.deepEqual(list.find((w) => w.name === 'lunch spots').names, ['Pizza', 'Tacos']);
  assert.deepEqual(list.find((w) => w.name === 'mods'), { name: 'mods', type: 'role', roleId: R1, roleName: 'Mod' });
  const raw = (await pg.query("SELECT data FROM wheel_saved WHERE name='mods'")).rows[0].data;
  assert.deepEqual(raw, { role_id: R1, role_name: 'Mod' }, 'stored in exactly the shape the bot reads');

  await save({ name: 'lunch spots', type: 'names', names: ['Sushi'] }); // replace
  assert.deepEqual((await c.listWheels(G)).find((w) => w.name === 'lunch spots').names, ['Sushi']);

  await assert.rejects(() => save({ name: 'x', type: 'role', roleId: '300000000000000099' }), /not a role in this server/);
  await assert.rejects(() => save({ name: 'x', type: 'names', names: [] }), /at least one name/);
  await assert.rejects(() => save({ name: 'x', type: 'names', names: ['a'.repeat(101)] }), /at most 100/);
  await assert.rejects(() => save({ name: 'x', type: 'names', names: Array.from({ length: 201 }, (_, i) => `n${i}`) }), /at most 200/);
  await assert.rejects(() => save({ name: 'x'.repeat(51), type: 'all' }), /at most 50/);
  await assert.rejects(() => save({ name: 'bad\nname', type: 'all' }), /not allowed/);
  await assert.rejects(() => save({ name: 'x', type: 'weird' }), /names, role or all/);
  await assert.rejects(() => save({ name: 5, type: 'all' }), /must be text/);

  assert.equal((await c.deleteWheel({ guildId: G, rawName: 'MODS', actorId: U_MANAGE })).name, 'mods');
  assert.equal((await c.deleteWheel({ guildId: G, rawName: 'mods', actorId: U_MANAGE })).error, 'missing');

  for (let i = 0; i < 22; i += 1) assert.ok(!(await save({ name: `w${i}`, type: 'all' })).error); // 2 existing + 22 = 24... plus default/lunch = total 24
  assert.ok(!(await save({ name: 'w22', type: 'all' })).error);
  assert.equal((await save({ name: 'w23', type: 'all' })).error, 'limit');
  assert.ok(!(await save({ name: 'w22', type: 'names', names: ['edit still works at the limit'] })).error);
  assert.equal((await pg.query("SELECT COUNT(*)::int n FROM mod_events WHERE kind='dashboard_wheel'")).rows[0].n > 5, true);

  await pg.query("INSERT INTO wheel_saved (guild_id, name, type, data) VALUES ($1,'theirs','all','{}')", [G2]);
  assert.equal((await c.listWheels(G2)).length, 1, 'servers are separate');
});

test('custom commands: save/list/replace/delete, name rules, response rules, 100 limit', async () => {
  const { pg, sql } = await freshDb();
  const c = createCommunity(sql);
  const save = (rawName, response) => c.saveCommand({ guildId: G, rawName, response, actorId: U_ADMIN });
  assert.equal((await save('!Hello', '  Hi there  ')).name, 'hello');
  await save('/rules', 'Be nice');
  assert.deepEqual((await c.listCommands(G)).map((x) => [x.name, x.response, x.createdBy]), [['hello', 'Hi there', U_ADMIN], ['rules', 'Be nice', U_ADMIN]]);
  await save('hello', 'Hello again');
  assert.equal((await c.listCommands(G))[0].response, 'Hello again');
  for (const bad of ['', 'two words', 'a'.repeat(33), 'emoji😀', '../x', '!']) await assert.rejects(() => save(bad, 'x'), /letters, numbers/, bad);
  await assert.rejects(() => save('ok', ''), /cannot be empty/);
  await assert.rejects(() => save('ok', '   '), /cannot be empty/);
  await assert.rejects(() => save('ok', 'x'.repeat(1801)), /at most 1800/);
  await assert.rejects(() => save('ok', 5), /must be text/);
  assert.ok(!(await save('max', 'x'.repeat(1800))).error);
  assert.equal((await c.deleteCommand({ guildId: G, rawName: '!HELLO', actorId: U_ADMIN })).name, 'hello');
  assert.equal((await c.deleteCommand({ guildId: G, rawName: 'hello', actorId: U_ADMIN })).error, 'missing');
  await pg.query("INSERT INTO custom_commands (guild_id, name, response) SELECT $1, 'c' || g, 'x' FROM generate_series(1, 98) g", [G]); // rules, max + 98 = 100
  assert.equal((await save('onetoomany', 'x')).error, 'limit');
  assert.ok(!(await save('c5', 'editing at the limit is fine')).error);
  assert.equal((await pg.query("SELECT COUNT(*)::int n FROM mod_events WHERE kind='dashboard_command'")).rows[0].n > 3, true);
  assert.equal((await createCommunity((await freshDb({ schema: false })).sql).listWheels(G)).length, 0, 'missing tables read as empty');
});

test('handler: wheel and command routes enforce levels, origin and validation', async () => {
  const { pg, sql } = await freshDb();
  const h = createHandler({ data: createData(sql), community: createCommunity(sql) });
  const admin = [sessionCookie(U_ADMIN), dashCookie(U_ADMIN, { [G]: 'admin' })];
  const manage = [sessionCookie(U_MANAGE), dashCookie(U_MANAGE, { [G]: 'manage' })];

  const w = await post(h, { r: 'wheel', g: G }, manage, { action: 'save', name: 'Games', type: 'names', names: ['Chess', 'Go'] });
  assert.equal(w.code, 200);
  assert.deepEqual((await call(h, { query: { r: 'wheels', g: G }, cookies: manage })).body, { wheels: [{ name: 'games', type: 'names', names: ['Chess', 'Go'] }], editable: true });
  assert.equal((await post(h, { r: 'wheel', g: G }, manage, { action: 'save', name: 'x', type: 'names', names: [] })).code, 400);
  assert.equal((await post(h, { r: 'wheel', g: G }, manage, { action: 'nope' })).code, 400);
  assert.equal((await post(h, { r: 'wheel', g: G }, manage, { action: 'delete', name: 'ghost' })).code, 404);
  assert.equal((await post(h, { r: 'wheel', g: G }, manage, { action: 'save', name: 'x', type: 'all' }, { origin: 'https://evil.test' })).code, 403);
  assert.equal((await post(h, { r: 'wheel', g: G }, manage, { action: 'delete', name: 'games' })).code, 200);
  assert.equal((await post(h, { r: 'wheel', g: G2 }, manage, { action: 'save', name: 'x', type: 'all' })).code, 403, 'not their server');

  const cm = await call(h, { query: { r: 'commands', g: G }, cookies: manage });
  assert.equal(cm.body.editable, false);
  const denied = await post(h, { r: 'command', g: G }, manage, { action: 'save', name: 'hi', response: 'yo' });
  assert.equal(denied.code, 403); assert.match(denied.body.error, /Administrator/);
  assert.equal((await pg.query('SELECT 1 FROM custom_commands')).rows.length, 0);
  assert.equal((await post(h, { r: 'command', g: G }, admin, { action: 'save', name: '!hi', response: 'yo' })).code, 200);
  assert.equal((await call(h, { query: { r: 'commands', g: G }, cookies: admin })).body.commands[0].name, 'hi');
  assert.equal((await post(h, { r: 'command', g: G }, admin, { action: 'save', name: 'bad name', response: 'yo' })).code, 400);
  assert.equal((await post(h, { r: 'command', g: G }, admin, { action: 'delete', name: 'hi' })).code, 200);
  assert.equal((await call(h, { method: 'POST', query: { r: 'command', g: G }, cookies: admin, body: { action: 'save', name: 'a', response: 'b' }, headers: { 'content-type': 'application/json' } })).code, 403, 'no Origin');
});
