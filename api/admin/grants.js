const { getSessionFromRequest, isAdmin } = require('../_auth');
const { sql, ensureSchema } = require('../_db');
const products = require('../_products');

module.exports = async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!isAdmin(session)) {
    return res.status(403).json({ error: 'Admins only' });
  }

  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT id, discord_user_id, product_id, source, granted_at
      FROM grants ORDER BY granted_at DESC LIMIT 100
    `;
    const grants = rows.map((row) => ({
      id: row.id,
      discordUserId: row.discord_user_id,
      productId: row.product_id,
      productName: (products.find((p) => p.id === row.product_id) || {}).name || row.product_id,
      source: row.source,
      grantedAt: row.granted_at,
    }));
    return res.status(200).json({ grants });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error loading grants' });
  }
};
