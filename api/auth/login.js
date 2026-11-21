module.exports = async function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    return res.end('Discord login is not configured (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI missing)');
  }

  // Carries the page to return to after login through Discord and back to
  // our callback — Discord passes `state` back unchanged.
  const returnTo = (req.query && req.query.returnTo) || '/account';
  // Dashboard logins also ask for the user's server list (the `guilds` scope) so we can tell which servers they manage.
  // `silent` re-checks permissions without showing Discord's approval screen again (it only works if they've approved before).
  const dash = req.query && req.query.dash === '1';
  const silent = dash && req.query.silent === '1';
  const state = Buffer.from(JSON.stringify({ returnTo, dash, silent })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: dash ? 'identify guilds' : 'identify',
    state,
  });
  if (silent) params.set('prompt', 'none');

  res.statusCode = 302;
  res.setHeader('Location', `https://discord.com/oauth2/authorize?${params.toString()}`);
  return res.end();
};
