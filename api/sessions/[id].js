import { prisma } from '../_lib/prisma.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }

    const session = await prisma.session.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        sessionDate: true,
        endTime: true,
        timeZone: true,
        venue: true,
        capacity: true,
        status: true,
        facilitator: {
          select: {
            id: true,
            name: true,
            title: true,
            bio: true,
            photoUrl: true,
            expertise: true,
            linkedinUrl: true,
          },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const now = new Date();
    const sessionDate = new Date(session.sessionDate);
    const isOpen = sessionDate > now && session.status === 'UPCOMING';
    const isFull = session.capacity ? session._count.registrations >= session.capacity : false;

    return res.status(200).json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        description: session.description,
        sessionDate: session.sessionDate,
        endTime: session.endTime,
        timeZone: session.timeZone,
        format: session.venue || 'Virtual Seminar',
        capacity: session.capacity,
        registrationsCount: session._count.registrations,
        isOpenForRegistration: isOpen && !isFull,
        isFull,
        status: session.status,
        facilitator: session.facilitator,
      },
    });
  } catch (error) {
    console.error('Error fetching session details:', error);
    return res.status(500).json({ error: 'Failed to fetch session details.' });
  }
}
