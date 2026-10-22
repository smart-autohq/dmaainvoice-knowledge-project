import { prisma } from '../../_lib/prisma.js';
import { withAuth } from '../../_lib/auth.js';

async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Registration ID is required.' });
  }

  if (req.method === 'GET') {
    try {
      const reg = await prisma.registration.findUnique({
        where: { id },
        include: {
          participant: true,
          session: {
            include: {
              facilitator: true,
            },
          },
        },
      });

      if (!reg) {
        return res.status(404).json({ error: 'Registration record not found.' });
      }

      return res.status(200).json({ success: true, data: reg });
    } catch (error) {
      console.error('Error fetching registration detail:', error);
      return res.status(500).json({ error: 'Failed to retrieve registration.' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { attended } = req.body || {};

      if (attended === undefined) {
        return res.status(400).json({ error: 'Attended status (boolean) is required.' });
      }

      const updated = await prisma.registration.update({
        where: { id },
        data: { attended: Boolean(attended) },
        include: {
          participant: { select: { firstName: true, lastName: true, email: true } },
          session: { select: { title: true } },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Attendance marked as ${updated.attended ? 'Attended' : 'Unattended'}.`,
        data: updated,
      });
    } catch (error) {
      console.error('Error updating attendance:', error);
      return res.status(500).json({ error: 'Failed to update attendance status.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.registration.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        message: 'Registration record removed.',
      });
    } catch (error) {
      console.error('Error removing registration:', error);
      return res.status(500).json({ error: 'Failed to remove registration.' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
