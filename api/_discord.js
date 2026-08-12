// Posts an order notification to your Discord server via a webhook.
// Set DISCORD_WEBHOOK_URL as a Vercel env var (Server Settings > Integrations
// > Webhooks in Discord). This is never exposed to the browser.

async function notifyDiscord({ productName, price, payerName, payerEmail, orderId }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL is not set — skipping Discord notification');
    return;
  }

  const embed = {
    title: 'New Order 🛒',
    color: 0x5865f2,
    fields: [
      { name: 'Product', value: productName, inline: true },
      { name: 'Price', value: `£${price.toFixed(2)}`, inline: true },
      { name: 'Buyer', value: payerName || 'Unknown', inline: true },
      { name: 'Email', value: payerEmail || 'Unknown', inline: true },
      { name: 'PayPal Order ID', value: orderId },
    ],
    timestamp: new Date().toISOString(),
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

module.exports = { notifyDiscord };
