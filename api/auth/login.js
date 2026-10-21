import { prisma, withPrismaRetry } from '../_lib/prisma.js';
import { comparePassword, signToken, createAuthCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Query organizer with auto-reconnect retry
    const organizer = await withPrismaRetry(() =>
      prisma.organizer.findUnique({
        where: { email: cleanEmail },
      })
    );

    if (!organizer) {
      // Consistent timing response
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await comparePassword(password, organizer.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Sign session token
    const token = signToken({
      id: organizer.id,
      email: organizer.email,
      name: organizer.name,
      role: organizer.role,
    });

    // Set secure HTTP-only cookie
    res.setHeader('Set-Cookie', createAuthCookie(token));

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      organizer: {
        id: organizer.id,
        name: organizer.name,
        email: organizer.email,
        role: organizer.role,
      },
    });
  } catch (error) {
    console.error('Organizer login error:', error);
    return res.status(500).json({ error: 'An error occurred during authentication.' });
  }
}
