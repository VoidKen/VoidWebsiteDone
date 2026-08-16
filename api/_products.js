// IMPORTANT: keep this in sync with src/data/products.js.
// This is the source of truth for prices at checkout time — the server
// never trusts a price sent from the browser, only the productId.

const products = [
  {
    id: 'custom-command',
    name: 'Custom Command',
    price: 8.49,
  },
  {
    id: 'small-custom-mod',
    name: 'Small Custom Mod',
    price: 5.49,
  },
  {
    id: 'medium-custom-mod',
    name: 'Medium Custom Mod',
    price: 10.99,
  },
  {
    id: 'large-custom-mod',
    name: 'Large Custom Mod',
    price: 30.99,
  },
  {
    id: 'custom-discord-bot',
    name: 'Custom Discord Bot',
    price: 54.99,
  },
];

module.exports = products;
