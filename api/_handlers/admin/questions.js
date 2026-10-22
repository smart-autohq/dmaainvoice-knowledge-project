import { withAuth } from '../../_lib/auth.js';
import { getQuestionsConfig, saveQuestionsConfig } from '../../_lib/questions.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const config = await getQuestionsConfig();
      return res.status(200).json({ success: true, data: config });
    } catch (error) {
      console.error('Error fetching admin questions config:', error);
      return res.status(500).json({ error: 'Failed to retrieve question configuration.' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Invalid question configuration payload.' });
      }

      const saved = await saveQuestionsConfig(payload);
      return res.status(200).json({
        success: true,
        message: 'Registration questions configuration saved successfully.',
        data: saved,
      });
    } catch (error) {
      console.error('Error saving admin questions config:', error);
      return res.status(500).json({ error: 'Failed to save question configuration.' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
