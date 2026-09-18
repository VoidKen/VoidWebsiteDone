const { getSessionFromRequest, isAdmin } = require('../_auth');
const { sql, ensureSchema } = require('../_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!isAdmin(session)) {
    return res.status(403).json({ error: 'Admins only' });
  }

  const { grantId } = req.body || {};
  if (!grantId) {
    return res.status(400).json({ error: 'Missing grantId' });
  }

  try {
    await ensureSchema();
    const { rowCount } = await sql`
      DELETE FROM grants WHERE id = ${grantId}
    `;
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Grant not found (already removed?)' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error revoking grant' });
  }
};
