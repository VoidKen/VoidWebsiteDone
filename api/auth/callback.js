const { setSessionCookie } = require('../_auth');

function readReturnTo(req) {
  try {
    const state = req.query && req.query.state;
    if (!state) return '/account';
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    // Only ever redirect to a same-site path — never let this become an
    // open redirect to an attacker-controlled URL.
    if (typeof decoded.returnTo === 'string' && decoded.returnTo.startsWith('/')) {
      return decoded.returnTo;
    }
  } catch (err) {
    // fall through to default
  }
  return '/account';
}

module.exports = async function handler(req, res) {
  const { code } = req.query || {};
  const returnTo = readReturnTo(req);

  if (!code) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth_error=missing_code');
    return res.end();
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    });

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      throw new Error('Discord token exchange failed');
    }
    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch Discord user');
    }
    const user = await userRes.json();

    setSessionCookie(res, {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
    });

    // If this is you (ADMIN_DISCORD_ID) logging in generically — not in the
    // middle of something specific like a purchase — send straight to the
    // admin panel instead of the regular account page.
    const isAdminUser =
      !!process.env.ADMIN_DISCORD_ID && user.id === process.env.ADMIN_DISCORD_ID;
    const finalDestination =
      isAdminUser && returnTo === '/account' ? '/admin' : returnTo;

    res.statusCode = 302;
    res.setHeader('Location', finalDestination);
    return res.end();
  } catch (err) {
    console.error(err);
    res.statusCode = 302;
    res.setHeader('Location', '/?auth_error=login_failed');
    return res.end();
  }
};
