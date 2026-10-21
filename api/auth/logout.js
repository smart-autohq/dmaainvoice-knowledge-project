import { clearAuthCookie } from '../_lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  res.setHeader('Set-Cookie', clearAuthCookie());
  return res.status(200).json({
    success: true,
    message: 'Signed out successfully.',
  });
}
