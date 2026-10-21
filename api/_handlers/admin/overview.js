import { prisma } from '../../_lib/prisma.js';
import { withAuth } from '../../_lib/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const [
      totalSessions,
      upcomingSessionsCount,
      completedSessionsCount,
      totalRegistrations,
      attendedCount,
      totalParticipants,
      activeSubscribers,
      totalFacilitators,
      recentRegistrations,
      upcomingSessions,
    ] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({ where: { status: 'UPCOMING' } }),
      prisma.session.count({ where: { status: 'COMPLETED' } }),
      prisma.registration.count(),
      prisma.registration.count({ where: { attended: true } }),
      prisma.participant.count(),
      prisma.participant.count({ where: { subscribed: true } }),
      prisma.facilitator.count(),
      prisma.registration.findMany({
        take: 8,
        orderBy: { registeredAt: 'desc' },
        include: {
          participant: {
            select: { id: true, firstName: true, lastName: true, email: true, organization: true },
          },
          session: {
            select: { id: true, title: true, sessionDate: true },
          },
        },
      }),
      prisma.session.findMany({
        where: { status: 'UPCOMING' },
        take: 5,
        orderBy: { sessionDate: 'asc' },
        include: {
          facilitator: { select: { id: true, name: true } },
          _count: { select: { registrations: true } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalSessions,
          upcomingSessionsCount,
          completedSessionsCount,
          totalRegistrations,
          attendedCount,
          attendanceRate: totalRegistrations > 0 ? Math.round((attendedCount / totalRegistrations) * 100) : 0,
          totalParticipants,
          activeSubscribers,
          totalFacilitators,
        },
        recentRegistrations,
        upcomingSessions,
      },
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
}

export default withAuth(handler);
