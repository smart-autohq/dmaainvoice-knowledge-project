import { prisma, withPrismaRetry } from './_lib/prisma.js';
import { buildFormSchemaForSession, getQuestionsConfig } from './_lib/questions.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { sessionId } = req.query || {};

    if (!sessionId) {
      const config = await getQuestionsConfig();
      return res.status(200).json({
        success: true,
        data: config,
      });
    }

    const session = await withPrismaRetry(() =>
      prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          facilitator: {
            select: { id: true, name: true, title: true, photoUrl: true },
          },
          _count: {
            select: { registrations: true },
          },
        },
      })
    );

    if (!session) {
      return res.status(404).json({
        error: 'Session Not Found',
        message: 'The requested knowledge session does not exist.',
      });
    }

    const schema = await buildFormSchemaForSession(session);

    return res.status(200).json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error('Error serving questions API:', error);
    return res.status(500).json({
      error: 'Failed to load registration schema',
      message: 'Could not load questions for this session. Please try again.',
    });
  }
}
