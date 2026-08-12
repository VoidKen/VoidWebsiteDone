const { getSessionFromRequest, isAdmin } = require('../_auth');

module.exports = async function handler(req, res) {
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.status(200).json({ user: null });
  }

  return res.status(200).json({
    user: {
      id: session.id,
      username: session.username,
      avatar: session.avatar,
      isAdmin: isAdmin(session),
    },
  });
};
