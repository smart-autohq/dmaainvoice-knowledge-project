import { prisma } from '../_lib/prisma.js';
import { withAuth } from '../_lib/auth.js';

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const facilitators = await prisma.facilitator.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { sessions: true } },
        },
      });

      return res.status(200).json({ success: true, count: facilitators.length, data: facilitators });
    } catch (error) {
      console.error('Error fetching admin facilitators:', error);
      return res.status(500).json({ error: 'Failed to fetch facilitators.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, title, bio, photoUrl, expertise, linkedinUrl } = req.body || {};

      if (!name || !title || !bio) {
        return res.status(400).json({ error: 'Name, title, and bio are required.' });
      }

      // Convert expertise string/array
      let parsedExpertise = [];
      if (Array.isArray(expertise)) {
        parsedExpertise = expertise.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof expertise === 'string') {
        parsedExpertise = expertise.split(',').map(t => t.trim()).filter(Boolean);
      }

      const facilitator = await prisma.facilitator.create({
        data: {
          name: name.trim(),
          title: title.trim(),
          bio: bio.trim(),
          photoUrl: photoUrl ? photoUrl.trim() : null,
          expertise: parsedExpertise,
          linkedinUrl: linkedinUrl ? linkedinUrl.trim() : null,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Facilitator created successfully.',
        data: facilitator,
      });
    } catch (error) {
      console.error('Error creating facilitator:', error);
      return res.status(500).json({ error: 'Failed to create facilitator.' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, name, title, bio, photoUrl, expertise, linkedinUrl } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'Facilitator ID is required for updating.' });
      }

      let parsedExpertise = undefined;
      if (Array.isArray(expertise)) {
        parsedExpertise = expertise.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof expertise === 'string') {
        parsedExpertise = expertise.split(',').map(t => t.trim()).filter(Boolean);
      }

      const data = {};
      if (name !== undefined) data.name = name.trim();
      if (title !== undefined) data.title = title.trim();
      if (bio !== undefined) data.bio = bio.trim();
      if (photoUrl !== undefined) data.photoUrl = photoUrl ? photoUrl.trim() : null;
      if (parsedExpertise !== undefined) data.expertise = parsedExpertise;
      if (linkedinUrl !== undefined) data.linkedinUrl = linkedinUrl ? linkedinUrl.trim() : null;

      const updated = await prisma.facilitator.update({
        where: { id },
        data,
      });

      return res.status(200).json({
        success: true,
        message: 'Facilitator updated successfully.',
        data: updated,
      });
    } catch (error) {
      console.error('Error updating facilitator:', error);
      return res.status(500).json({ error: 'Failed to update facilitator.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Facilitator ID is required.' });
      }

      await prisma.facilitator.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        message: 'Facilitator profile deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting facilitator:', error);
      return res.status(500).json({ error: 'Failed to delete facilitator.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

export default withAuth(handler);
