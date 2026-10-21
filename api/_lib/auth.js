import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production' ? null : 'dmaainvoice_fallback_dev_secret_2026'
);
const TOKEN_COOKIE_NAME = 'dm_organizer_token';

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
}

export async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function signToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift().trim();
    const value = decodeURIComponent(parts.join('='));
    if (name) list[name] = value;
  });

  return list;
}

export function createAuthCookie(token) {
  const isProd = process.env.NODE_ENV === 'production';
  // 7 days in seconds: 7 * 24 * 60 * 60 = 604800
  return `${TOKEN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProd ? '; Secure' : ''}`;
}

export function clearAuthCookie() {
  const isProd = process.env.NODE_ENV === 'production';
  return `${TOKEN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
}

export async function getAuthenticatedOrganizer(req) {
  // Check Authorization Bearer header first
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check cookies
    const cookies = parseCookies(req.headers.cookie);
    token = cookies[TOKEN_COOKIE_NAME];
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) return null;

  // Verify organizer still exists in DB
  const organizer = await prisma.organizer.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  return organizer;
}

export function withAuth(handler, allowedRoles = []) {
  return async (req, res) => {
    try {
      const organizer = await getAuthenticatedOrganizer(req);

      if (!organizer) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Valid organizer session required. Please sign in.',
        });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(organizer.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient privileges for this operation.',
        });
      }

      req.organizer = organizer;
      return handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to authenticate request.',
      });
    }
  };
}
