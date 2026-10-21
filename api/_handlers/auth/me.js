import { withAuth } from '../../_lib/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  return res.status(200).json({
    success: true,
    organizer: req.organizer,
  });
}

export default withAuth(handler);
