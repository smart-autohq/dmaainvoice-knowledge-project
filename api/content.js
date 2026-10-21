import { prisma } from './_lib/prisma.js';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Try reading persistent content from Neon database
    const dbContent = await prisma.siteContent.findUnique({
      where: { key: 'homepage' },
    });

    if (dbContent && dbContent.value) {
      return res.status(200).json({ success: true, data: dbContent.value });
    }

    // 2. Fallback to local JSON if DB row is not initialized
    const filePath = path.join(process.cwd(), 'content.json');
    const data = await fs.readFile(filePath, 'utf-8');
    return res.status(200).json({ success: true, data: JSON.parse(data) });
  } catch (error) {
    console.error('Error reading website content:', error);
    // Fallback
    try {
      const filePath = path.join(process.cwd(), 'content.json');
      const data = await fs.readFile(filePath, 'utf-8');
      return res.status(200).json({ success: true, data: JSON.parse(data) });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load website content.' });
    }
  }
}
