const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, isAdmin } = require('./_auth');
const { sql, ensureSchema } = require('./_db');
const products = require('./_products');

module.exports = async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Sign in to download this' });
  }

  const productId = req.query && req.query.product;
  const product = products.find((p) => p.id === productId);

  if (!product || !product.file) {
    return res.status(404).json({ error: 'No downloadable file for this product' });
  }

  try {
    if (!isAdmin(session)) {
      await ensureSchema();
      const { rows } = await sql`
        SELECT 1 FROM grants
        WHERE discord_user_id = ${session.id} AND product_id = ${productId}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return res.status(403).json({ error: "You don't own this product" });
      }
    }

    const filePath = path.join(process.cwd(), 'private-files', product.file);
    const fileBuffer = fs.readFileSync(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${product.file}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.status(200).send(fileBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error fetching file' });
  }
};
