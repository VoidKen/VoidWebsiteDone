const { getStripe } = require('./_stripe');
const products = require('./_products');
const { getSessionFromRequest } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Sign in with Discord before buying' });
  }

  try {
    const { productId } = req.body || {};
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return res.status(400).json({ error: 'Unknown product' });
    }

    const stripe = getStripe();

    // Figure out the site origin so success/cancel redirects go back to
    // the right place, whether you're on a Vercel preview URL or your
    // real domain.
    const origin =
      req.headers.origin ||
      `https://${req.headers.host}`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: Math.round(product.price * 100), // pence
          },
          quantity: 1,
        },
      ],
      // productId travels with the session so the webhook knows what was
      // bought. client_reference_id is the buyer's Discord ID, so the
      // webhook knows WHO to grant it to.
      metadata: { productId: product.id },
      client_reference_id: session.id,
      success_url: `${origin}/shop?success=1&product=${product.id}`,
      cancel_url: `${origin}/shop?canceled=1`,
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error creating checkout session' });
  }
};
