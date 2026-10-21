import crypto from 'crypto';
import { prisma, withPrismaRetry } from '../_lib/prisma.js';
import { sendParticipantWelcomeEmail } from '../_lib/mailer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { fullName, email } = req.body || {};

    // 1. Full Name validation (strictly full name, minimum 2 characters)
    const resolvedFullName = typeof fullName === 'string' ? fullName.trim() : '';
    if (!resolvedFullName || resolvedFullName.length < 2) {
      return res.status(400).json({
        error: 'Invalid Full Name',
        message: 'Please provide your full name (at least 2 characters).',
      });
    }

    // 2. Email validation (valid regex format)
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        error: 'Missing Email',
        message: 'A valid email address is required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: 'Invalid Email Format',
        message: 'Please provide a valid email address (e.g. name@domain.com).',
      });
    }

    // 3. Split fullName into firstName and lastName
    const nameParts = resolvedFullName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // 4. Duplicate & Existing Participant Check
    const existingParticipant = await withPrismaRetry(() =>
      prisma.participant.findUnique({
        where: { email: cleanEmail },
      })
    );

    if (existingParticipant) {
      if (existingParticipant.subscribed) {
        return res.status(409).json({
          error: 'Already Registered',
          message: `You are already registered as a participant in the D Maain Voice Knowledge Project. General announcements and cohort notifications are already sent to ${cleanEmail}.`,
        });
      }

      // Existing participant from previous session registration: safely upgrade to active community participant
      const updatedParticipant = await withPrismaRetry(() =>
        prisma.participant.update({
          where: { id: existingParticipant.id },
          data: {
            firstName: firstName || existingParticipant.firstName,
            lastName: lastName || existingParticipant.lastName,
            consentGiven: true,
            subscribed: true,
          },
        })
      );

      sendParticipantWelcomeEmail({ participant: updatedParticipant }).catch((mailErr) => {
        console.error('Failed to dispatch participant welcome email:', mailErr);
      });

      return res.status(200).json({
        success: true,
        message: 'Welcome to the D Maain Voice Knowledge Project! You are now an active community participant.',
        data: {
          participantId: updatedParticipant.id,
          fullName: `${updatedParticipant.firstName} ${updatedParticipant.lastName}`.trim(),
          email: updatedParticipant.email,
          registeredAt: updatedParticipant.registeredAt,
        },
      });
    }

    // 5. Create Participant record in Neon PostgreSQL (Zero session associations)
    const unsubscribeToken = crypto.randomBytes(24).toString('hex');
    const participant = await withPrismaRetry(() =>
      prisma.participant.create({
        data: {
          firstName,
          lastName,
          email: cleanEmail,
          country: 'Nigeria',
          consentGiven: true,
          subscribed: true,
          unsubscribeToken,
        },
      })
    );

    // 6. Asynchronously send welcome email to new community participant
    sendParticipantWelcomeEmail({ participant }).catch((mailErr) => {
      console.error('Failed to dispatch participant welcome email:', mailErr);
    });

    return res.status(201).json({
      success: true,
      message: 'Welcome to the D Maain Voice Knowledge Project! You are now officially registered as a participant.',
      data: {
        participantId: participant.id,
        fullName: `${participant.firstName} ${participant.lastName}`.trim(),
        email: participant.email,
        registeredAt: participant.registeredAt,
      },
    });
  } catch (error) {
    console.error('Participant registration processing error:', error);
    return res.status(500).json({
      error: 'Registration Failed',
      message: 'An unexpected error occurred while processing your participant registration. Please try again.',
    });
  }
}
