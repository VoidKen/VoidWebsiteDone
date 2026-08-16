// IMPORTANT: keep this in sync with src/data/products.js.
// This is the source of truth for prices and files at checkout/download
// time — the server never trusts a price or file from the browser, only
// the productId.

const products = [
  {
    id: 'custom-command',
    name: 'Custom Command',
    description: 'Custom command that will be linked to your Discord user ID to get one made.',
    price: 8.49,
    stock: 1,
    image: '/shop-bg.png',
    file: null,
  },
  {
    id: 'small-custom-mod',
    name: 'Small Custom Mod',
    description: 'A small custom mod. Once you\'ve paid, open a ticket on my Discord server.',
    price: 5.49,
    stock: 1,
    image: '/voidverse-logo.png',
    file: null,
  },
  {
    id: 'medium-custom-mod',
    name: 'Medium Custom Mod',
    description: 'A medium custom mod. Once you\'ve paid, open a ticket on my Discord server.',
    price: 10.99,
    stock: 1,
    image: '/shop-bg.png',
    file: null,
  },
  {
    id: 'large-custom-mod',
    name: 'Large Custom Mod',
    description: 'A large custom mod. Once you\'ve paid, open a ticket on my Discord server.',
    price: 30.99,
    stock: 1,
    image: '/shop-bg.png',
    file: null,
  },
  {
    id: 'custom-discord-bot',
    name: 'Custom Discord Bot',
    description: 'I will make you a custom Discord bot with custom features.',
    price: 54.99,
    stock: 1,
    image: '/shop-bg.png',
    file: null,
  },
  {
    id: 'custom-mc-launcher',
    name: 'Custom Mc Launcher',
    description: 'Custom Minecraft Launcher .',
    price: 20.00,
    stock: 1,
    image: '/shop-bg.png',
    file: null,
  },
];

module.exports = products;
