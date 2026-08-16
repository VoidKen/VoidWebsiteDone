const { clearSessionCookie } = require('../_auth');

module.exports = async function handler(req, res) {
  clearSessionCookie(res);
  res.statusCode = 302;
  res.setHeader('Location', '/');
  return res.end();
};
