// Signs and reads a small JWT stored in an httpOnly cookie. This is the
// site's entire "session" — no server-side session store needed.
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'void_session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days, in seconds

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return secret;
}

function signSession(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_DURATION });
}

function getSessionFromRequest(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret());
  } catch (err) {
    return null; // expired or tampered — treat as logged out
  }
}

function setSessionCookie(res, payload) {
  const token = signSession(payload);
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

function isAdmin(session) {
  return (
    !!session &&
    !!process.env.ADMIN_DISCORD_ID &&
    session.id === process.env.ADMIN_DISCORD_ID
  );
}

module.exports = {
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  isAdmin,
};
