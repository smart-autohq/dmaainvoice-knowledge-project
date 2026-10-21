import { prisma } from '../../_lib/prisma.js';
import { withAuth } from '../../_lib/auth.js';
import { getCategoryLabel } from '../../_lib/categories.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const sessions = await prisma.session.findMany({
        orderBy: { sessionDate: 'asc' },
        include: {
          facilitator: {
            select: { id: true, name: true, title: true },
          },
          organizer: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { registrations: true },
          },
        },
      });

      const formatted = sessions.map(s => ({
        ...s,
        categoryLabel: getCategoryLabel(s.category),
      }));

      return res.status(200).json({ success: true, count: formatted.length, data: formatted });
    } catch (error) {
      console.error('Error fetching admin sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch sessions.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        title,
        description,
        category,
        format = 'Virtual Seminar',
        takeaways = [],
        sessionDate,
        endTime,
        timeZone = 'Africa/Lagos',
        venue = 'Google Meet (Virtual)',
        meetingLink,
        meetingId,
        passcode,
        capacity,
        status = 'UPCOMING',
        facilitatorId,
      } = req.body || {};

      if (!title || !description || !sessionDate) {
        return res.status(400).json({ error: 'Title, description, and session date are required.' });
      }

      // Format takeaways into array
      let parsedTakeaways = [];
      if (Array.isArray(takeaways)) {
        parsedTakeaways = takeaways.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof takeaways === 'string') {
        parsedTakeaways = takeaways.split('\n').map(t => t.trim()).filter(Boolean);
      }

      if (facilitatorId) {
        const facExists = await prisma.facilitator.findUnique({ where: { id: facilitatorId } });
        if (!facExists) {
          return res.status(400).json({ error: 'Specified facilitator was not found.' });
        }
      }

      const newSession = await prisma.session.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          category: (category && typeof category === 'string') ? category.trim() : 'technology',
          format: format.trim(),
          takeaways: parsedTakeaways,
          sessionDate: new Date(sessionDate),
          endTime: endTime ? new Date(endTime) : null,
          timeZone: timeZone.trim(),
          venue: venue ? venue.trim() : 'Google Meet (Virtual)',
          meetingLink: meetingLink ? meetingLink.trim() : null,
          meetingId: meetingId ? meetingId.trim() : null,
          passcode: passcode ? passcode.trim() : null,
          capacity: capacity ? parseInt(capacity, 10) : null,
          status,
          facilitatorId: facilitatorId || null,
          organizerId: req.organizer.id,
        },
        include: {
          facilitator: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Session created successfully.',
        data: {
          ...newSession,
          categoryLabel: getCategoryLabel(newSession.category),
        },
      });
    } catch (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({ error: 'Failed to create session.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
