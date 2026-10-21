import { prisma, withPrismaRetry } from '../_lib/prisma.js';
import { getCategoryLabel, getCategoryAliases } from '../_lib/categories.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { category, status } = req.query || {};

    const where = {};
    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['UPCOMING', 'LIVE'] };
    }

    if (category && category !== 'all') {
      const aliases = getCategoryAliases(category);
      if (aliases.length > 1) {
        where.category = { in: aliases };
      } else {
        where.category = category;
      }
    }

    const sessions = await withPrismaRetry(() =>
      prisma.session.findMany({
        where,
      orderBy: {
        sessionDate: 'asc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        takeaways: true,
        format: true,
        sessionDate: true,
        endTime: true,
        timeZone: true,
        venue: true,
        capacity: true,
        status: true,
        createdAt: true,
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
    })
  );

    const formatted = sessions.map((session) => {
      const now = new Date();
      const sessionDate = new Date(session.sessionDate);
      const isPast = sessionDate < now;
      const isOpenForRegistration = !isPast && session.status === 'UPCOMING';
      const isFull = session.capacity ? session._count.registrations >= session.capacity : false;

      return {
        id: session.id,
        title: session.title,
        description: session.description,
        category: session.category,
        categoryLabel: getCategoryLabel(session.category),
        takeaways: session.takeaways && session.takeaways.length > 0 ? session.takeaways : [
          'Mastering essential communication and domain architectures',
          'Interactive hands-on breakdowns with industry facilitators',
          'Live audience question-and-answer exchange',
          'Curated follow-up references and learning resources'
        ],
        format: session.format || session.venue || 'Virtual Seminar',
        venue: session.venue || 'Google Meet (Virtual)',
        date: sessionDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: `${sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}${session.endTime ? ' – ' + new Date(session.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : ' WAT'}`,
        rawSessionDate: session.sessionDate,
        capacity: session.capacity,
        registrationsCount: session._count.registrations,
        isFull,
        isOpenForRegistration: isOpenForRegistration && !isFull,
        statusText: isFull ? 'Capacity Reached' : (isOpenForRegistration ? 'Open for Registration' : 'Upcoming'),
        statusClass: isFull ? 'status-full' : (isOpenForRegistration ? 'status-open' : 'status-upcoming'),
        facilitator: session.facilitator ? {
          id: session.facilitator.id,
          name: session.facilitator.name,
          role: session.facilitator.title,
          bio: session.facilitator.bio,
          photoUrl: session.facilitator.photoUrl,
          expertise: session.facilitator.expertise,
          initials: session.facilitator.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        } : null,
      };
    });

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error('Error fetching public sessions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions.',
    });
  }
}


