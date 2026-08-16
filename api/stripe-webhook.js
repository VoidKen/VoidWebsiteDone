const { getStripe } = require('./_stripe');
const { notifyDiscord } = require('./_discord');
const { sql, ensureSchema } = require('./_db');
const products = require('./_products');

// Stripe needs the exact raw request bytes to verify the webhook
// signature, so we turn off Vercel's automatic JSON body parsing here.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event;

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const productId = session.metadata?.productId;
    const discordUserId = session.client_reference_id;
    const product = products.find((p) => p.id === productId);

    if (discordUserId && product) {
      try {
        await ensureSchema();
        // Stripe can deliver the same webhook event more than once — only
        // grant once per Stripe session.
        const { rows: existing } = await sql`
          SELECT 1 FROM grants WHERE stripe_session_id = ${session.id} LIMIT 1
        `;
        if (existing.length === 0) {
          await sql`
            INSERT INTO grants (discord_user_id, product_id, source, stripe_session_id)
            VALUES (${discordUserId}, ${productId}, 'stripe', ${session.id})
          `;
        }
      } catch (grantErr) {
        console.error('Failed to record grant for purchase', grantErr);
      }
    } else {
      console.error('Checkout completed without a Discord user or known product', {
        discordUserId,
        productId,
      });
    }

    try {
      await notifyDiscord({
        productName: product ? product.name : `Unknown product (${productId})`,
        price: product ? product.price : (session.amount_total || 0) / 100,
        payerName: session.customer_details?.name,
        payerEmail: session.customer_details?.email,
        orderId: session.id,
      });
    } catch (notifyErr) {
      console.error('Discord notification failed', notifyErr);
    }
  }

  return res.status(200).json({ received: true });
};
