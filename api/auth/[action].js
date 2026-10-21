import loginHandler from '../_handlers/auth/login.js';
import logoutHandler from '../_handlers/auth/logout.js';
import meHandler from '../_handlers/auth/me.js';

export default async function handler(req, res) {
  const { action } = req.query || {};

  switch (action) {
    case 'login':
      return loginHandler(req, res);
    case 'logout':
      return logoutHandler(req, res);
    case 'me':
      return meHandler(req, res);
    default:
      return res.status(404).json({ error: `Auth endpoint not found: ${action || ''}` });
  }
}
