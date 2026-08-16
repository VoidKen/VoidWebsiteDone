const { getSessionFromRequest } = require('./_auth');
const { sql, ensureSchema } = require('./_db');
const products = require('./_products');

module.exports = async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT product_id, source, granted_at FROM grants
      WHERE discord_user_id = ${session.id}
      ORDER BY granted_at DESC
    `;

    const owned = rows.map((row) => {
      const product = products.find((p) => p.id === row.product_id);
      return {
        productId: row.product_id,
        name: product ? product.name : row.product_id,
        grantedAt: row.granted_at,
        source: row.source,
        hasFile: !!(product && product.file),
      };
    });

    return res.status(200).json({ products: owned });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error loading your products' });
  }
};
