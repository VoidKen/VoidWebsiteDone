const { getSessionFromRequest, isAdmin } = require('../_auth');
const { sql, ensureSchema } = require('../_db');
const products = require('../_products');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!isAdmin(session)) {
    return res.status(403).json({ error: 'Admins only' });
  }

  const { discordUserId, productId } = req.body || {};
  const product = products.find((p) => p.id === productId);

  if (!discordUserId || !product) {
    return res.status(400).json({ error: 'Missing Discord user ID or unknown product' });
  }

  try {
    await ensureSchema();
    await sql`
      INSERT INTO grants (discord_user_id, product_id, source)
      VALUES (${discordUserId}, ${productId}, 'admin')
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error granting product' });
  }
};
