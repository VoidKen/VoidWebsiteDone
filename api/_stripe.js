// Requires STRIPE_SECRET_KEY set as a Vercel env var (server-side only).
const Stripe = require('stripe');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(key);
}

module.exports = { getStripe };
