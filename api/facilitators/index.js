import { prisma, withPrismaRetry } from '../_lib/prisma.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const facilitators = await withPrismaRetry(() =>
      prisma.facilitator.findMany({
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          name: true,
          title: true,
          bio: true,
          photoUrl: true,
          expertise: true,
          linkedinUrl: true,
        },
      })
    );

    const formatted = facilitators.map((f) => ({
      id: f.id,
      name: f.name,
      role: f.title,
      bio: f.bio,
      photoUrl: f.photoUrl,
      topics: f.expertise,
      linkedinUrl: f.linkedinUrl,
      initials: f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching facilitators:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch facilitators roster.',
    });
  }
}
