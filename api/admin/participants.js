import { prisma } from '../_lib/prisma.js';
import { withAuth } from '../_lib/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { search, sessionId, format } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (sessionId) {
      where.registrations = {
        some: { sessionId },
      };
    }

    const participants = await prisma.participant.findMany({
      where,
      orderBy: { registeredAt: 'desc' },
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
        subscribed: true,
        registeredAt: true,
        registrations: {
          select: {
            id: true,
            registeredAt: true,
            attended: true,
            session: {
              select: { id: true, title: true, sessionDate: true },
            },
          },
        },
      },
    });

    // Check if client requests CSV download
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="dmaainvoice_participants.csv"');

      let csv = 'ID,First Name,Last Name,Email,Phone,Occupation,Organization,State,Country,Subscribed,Registered At,Sessions Count\n';
      for (const p of participants) {
        csv += `"${p.id}","${escapeCsv(p.firstName)}","${escapeCsv(p.lastName)}","${escapeCsv(p.email)}","${escapeCsv(p.phone || '')}","${escapeCsv(p.occupation || '')}","${escapeCsv(p.organization || '')}","${escapeCsv(p.state || '')}","${escapeCsv(p.country)}",${p.subscribed ? 'Yes' : 'No'},"${p.registeredAt.toISOString()}",${p.registrations.length}\n`;
      }
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      success: true,
      count: participants.length,
      data: participants,
    });
  } catch (error) {
    console.error('Error fetching admin participants:', error);
    return res.status(500).json({ error: 'Failed to retrieve participants.' });
  }
}

function escapeCsv(val) {
  return String(val).replace(/"/g, '""');
}

export default withAuth(handler);
