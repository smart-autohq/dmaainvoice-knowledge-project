import { prisma } from '../../_lib/prisma.js';
import { withAuth } from '../../_lib/auth.js';
import { getCategoryLabel } from '../../_lib/categories.js';

async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  if (req.method === 'GET') {
    try {
      const session = await prisma.session.findUnique({
        where: { id },
        include: {
          facilitator: true,
          organizer: { select: { id: true, name: true, email: true } },
          registrations: {
            include: {
              participant: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  occupation: true,
                  organization: true,
                  state: true,
                  country: true,
                  consentGiven: true,
                  subscribed: true,
                  registeredAt: true,
                },
              },
            },
            orderBy: { registeredAt: 'desc' },
          },
        },
      });

      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...session,
          categoryLabel: getCategoryLabel(session.category),
        },
      });
    } catch (error) {
      console.error('Error fetching admin session details:', error);
      return res.status(500).json({ error: 'Failed to retrieve session.' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const {
        title,
        description,
        category,
        format,
        takeaways,
        sessionDate,
        endTime,
        timeZone,
        venue,
        meetingLink,
        meetingId,
        passcode,
        capacity,
        status,
        facilitatorId,
      } = req.body || {};

      const data = {};
      if (title !== undefined) data.title = title.trim();
      if (description !== undefined) data.description = description.trim();
      if (category !== undefined) data.category = category.trim();
      if (format !== undefined) data.format = format.trim();
      if (takeaways !== undefined) {
        if (Array.isArray(takeaways)) {
          data.takeaways = takeaways.map(t => String(t).trim()).filter(Boolean);
        } else if (typeof takeaways === 'string') {
          data.takeaways = takeaways.split('\n').map(t => t.trim()).filter(Boolean);
        }
      }
      if (sessionDate !== undefined) data.sessionDate = new Date(sessionDate);
      if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
      if (timeZone !== undefined) data.timeZone = timeZone.trim();
      if (venue !== undefined) data.venue = venue.trim();
      if (meetingLink !== undefined) data.meetingLink = meetingLink ? meetingLink.trim() : null;
      if (meetingId !== undefined) data.meetingId = meetingId ? meetingId.trim() : null;
      if (passcode !== undefined) data.passcode = passcode ? passcode.trim() : null;
      if (capacity !== undefined) data.capacity = capacity ? parseInt(capacity, 10) : null;
      if (status !== undefined) data.status = status;
      if (facilitatorId !== undefined) data.facilitatorId = facilitatorId || null;

      const updated = await prisma.session.update({
        where: { id },
        data,
        include: { facilitator: true },
      });

      return res.status(200).json({
        success: true,
        message: 'Session updated successfully.',
        data: {
          ...updated,
          categoryLabel: getCategoryLabel(updated.category),
        },
      });
    } catch (error) {
      console.error('Error updating session:', error);
      return res.status(500).json({ error: 'Failed to update session.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.session.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        message: 'Session deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      return res.status(500).json({ error: 'Failed to delete session.' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
