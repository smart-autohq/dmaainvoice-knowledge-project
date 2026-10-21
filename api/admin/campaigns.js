import { prisma } from '../_lib/prisma.js';
import { withAuth } from '../_lib/auth.js';
import { sendEmail } from '../_lib/mailer.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const campaigns = await prisma.emailCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          session: { select: { id: true, title: true } },
          organizer: { select: { id: true, name: true } },
          _count: {
            select: { deliveries: true },
          },
        },
      });

      return res.status(200).json({ success: true, count: campaigns.length, data: campaigns });
    } catch (error) {
      console.error('Error fetching admin campaigns:', error);
      return res.status(500).json({ error: 'Failed to fetch campaigns.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { subject, body, sessionId } = req.body || {};

      if (!subject || !body) {
        return res.status(400).json({ error: 'Subject and body content are required.' });
      }

      if (sessionId) {
        const sessionExists = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!sessionExists) {
          return res.status(400).json({ error: 'Target session does not exist.' });
        }
      }

      const campaign = await prisma.emailCampaign.create({
        data: {
          subject: subject.trim(),
          body: body.trim(),
          sessionId: sessionId || null,
          organizerId: req.organizer.id,
          status: 'DRAFT',
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Email campaign drafted successfully.',
        data: campaign,
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      return res.status(500).json({ error: 'Failed to create campaign.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
