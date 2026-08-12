// Edit this list to add, remove, or change products.
// id must be unique — it's used for Stripe, Discord notifications, and
// download/ownership records, so don't change an id after people have
// bought it (they'd lose access to what they already own).
//
// file: the filename inside /private-files (server-side only — nothing
// in this file is a secret, but the actual file lives outside src/).
// Leave file: null for services that aren't a downloadable file (e.g.
// "open a ticket" custom work).
// stock: how many are available. Set to null for unlimited.

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
    id: 'voidsworld-mod',
    name: 'Voids World Mod',
    description: 'Multi-dimension management mod for Forge 1.20.1. Instant download after purchase.',
    price: 6.99,
    stock: null,
    image: '/shop-bg.png',
    file: 'voidsworld-1.20.1.jar',
  },
];

export default products;
