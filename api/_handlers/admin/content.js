import { prisma } from '../../_lib/prisma.js';
import { withAuth } from '../../_lib/auth.js';
import fs from 'fs/promises';
import path from 'path';

async function handler(req, res) {
  const filePath = path.join(process.cwd(), 'content.json');

  if (req.method === 'GET') {
    try {
      // 1. Fetch from Neon database
      const dbContent = await prisma.siteContent.findUnique({
        where: { key: 'homepage' },
      });

      if (dbContent && dbContent.value) {
        return res.status(200).json({ success: true, data: dbContent.value });
      }

      // 2. Fallback to file
      const data = await fs.readFile(filePath, 'utf-8');
      return res.status(200).json({ success: true, data: JSON.parse(data) });
    } catch (error) {
      console.error('Error reading admin content:', error);
      return res.status(500).json({ error: 'Failed to read content.' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const newContent = req.body;
      if (!newContent || typeof newContent !== 'object') {
        return res.status(400).json({ error: 'Invalid content payload.' });
      }

      // 1. Persist to Neon PostgreSQL database
      await prisma.siteContent.upsert({
        where: { key: 'homepage' },
        update: { value: newContent },
        create: { key: 'homepage', value: newContent },
      });

      // 2. Also sync to local JSON file for dev fallback
      await fs.writeFile(filePath, JSON.stringify(newContent, null, 2), 'utf-8').catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Website content and announcements persisted to database successfully.',
        data: newContent,
      });
    } catch (error) {
      console.error('Error updating admin content in database:', error);
      return res.status(500).json({ error: 'Failed to update website content in database.' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
