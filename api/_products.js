// IMPORTANT: keep this in sync with src/data/products.js.
// This is the source of truth for prices and files at checkout/download
// time — the server never trusts a price or file from the browser, only
// the productId.

const products = [
  {
    id: 'custom-command',
    name: 'Custom Command',
    price: 8.49,
    file: null,
  },
  {
    id: 'small-custom-mod',
    name: 'Small Custom Mod',
    price: 5.49,
    file: null,
  },
  {
    id: 'medium-custom-mod',
    name: 'Medium Custom Mod',
    price: 10.99,
    file: null,
  },
  {
    id: 'large-custom-mod',
    name: 'Large Custom Mod',
    price: 30.99,
    file: null,
  },
  {
    id: 'custom-discord-bot',
    name: 'Custom Discord Bot',
    price: 54.99,
    file: null,
  },
  {
    id: 'voidsworld-mod',
    name: 'Voids World Mod',
    price: 6.99,
    file: 'voidsworld-1.20.1.jar',
  },
];

module.exports = products;
