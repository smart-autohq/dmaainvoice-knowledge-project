import crypto from 'crypto';
import { prisma, withPrismaRetry } from './_lib/prisma.js';
import { sendRegistrationConfirmation } from './_lib/mailer.js';
import { buildFormSchemaForSession, validateSubmittedAnswers } from './_lib/questions.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const {
      sessionId,
      fullName,
      email,
      phone,
      occupation,
      organization,
      state,
      answers = {},
      // Optional fallback fields for backwards compatibility
      firstName: legacyFirstName,
      lastName: legacyLastName,
    } = req.body || {};

    // 1. Session ID validation
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({
        error: 'Missing Session ID',
        message: 'A valid session ID is required to register.',
      });
    }

    // 2. Full Name resolution
    let resolvedFullName = typeof fullName === 'string' ? fullName.trim() : '';
    if (!resolvedFullName && answers && answers.fullName) {
      resolvedFullName = String(answers.fullName).trim();
    }
    if (!resolvedFullName && (legacyFirstName || legacyLastName)) {
      resolvedFullName = `${legacyFirstName || ''} ${legacyLastName || ''}`.trim();
    }

    if (!resolvedFullName || resolvedFullName.length < 2) {
      return res.status(400).json({
        error: 'Invalid Full Name',
        message: 'Please provide your full name (at least 2 characters).',
      });
    }

    // 3. Email resolution & validation
    let resolvedEmail = typeof email === 'string' ? email.trim() : '';
    if (!resolvedEmail && answers && answers.email) {
      resolvedEmail = String(answers.email).trim();
    }

    if (!resolvedEmail) {
      return res.status(400).json({
        error: 'Missing Email',
        message: 'A valid email address is required.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = resolvedEmail.toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: 'Invalid Email Format',
        message: 'Please provide a valid email address (e.g. name@domain.com).',
      });
    }

    // Resolve phone & other common fields from root or answers
    const resolvedPhone = phone || (answers && answers.phone) || null;
    const resolvedOccupation = occupation || (answers && answers.occupation) || null;
    const resolvedOrg = organization || (answers && answers.organization) || null;
    const resolvedState = state || (answers && answers.state) || null;

    // Split fullName into firstName and lastName
    const nameParts = resolvedFullName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // 4. Verify Session & Capacity
    const session = await withPrismaRetry(() =>
      prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          facilitator: true,
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

    if (session.status !== 'UPCOMING') {
      return res.status(400).json({
        error: 'Registrations Closed',
        message: `Registrations are closed. This session is currently ${session.status.toLowerCase()}.`,
      });
    }

    if (new Date(session.sessionDate) < new Date()) {
      return res.status(400).json({
        error: 'Session Concluded',
        message: 'This session has already taken place.',
      });
    }

    // Check capacity limit
    if (session.capacity && session._count.registrations >= session.capacity) {
      return res.status(400).json({
        error: 'Session Full',
        message: 'Capacity has been reached for this session. Please look out for upcoming cohorts.',
      });
    }

    // 5. Dynamic Question Schema Validation
    const formSchema = await buildFormSchemaForSession(session);
    const allQuestions = [];
    for (const step of formSchema.steps) {
      if (Array.isArray(step.questions)) {
        allQuestions.push(...step.questions);
      }
    }

    // Combine any top-level properties into the answers dictionary for validation
    const mergedAnswers = {
      fullName: resolvedFullName,
      email: cleanEmail,
      phone: resolvedPhone,
      occupation: resolvedOccupation,
      organization: resolvedOrg,
      state: resolvedState,
      ...(answers || {}),
    };

    const validation = validateSubmittedAnswers(allQuestions, mergedAnswers);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      return res.status(400).json({
        error: 'Validation Failed',
        message: firstError || 'Please answer all required questions correctly.',
        fieldErrors: validation.errors,
      });
    }

    const finalCleanedAnswers = validation.cleanedAnswers;

    // 6. Find or Create Participant in PostgreSQL
    let participant = await withPrismaRetry(() =>
      prisma.participant.findUnique({
        where: { email: cleanEmail },
      })
    );

    if (participant) {
      participant = await withPrismaRetry(() =>
        prisma.participant.update({
          where: { id: participant.id },
          data: {
            firstName,
            lastName,
            phone: resolvedPhone || participant.phone,
            occupation: resolvedOccupation || participant.occupation,
            organization: resolvedOrg || participant.organization,
            state: resolvedState || participant.state,
            consentGiven: true,
          },
        })
      );
    } else {
      const unsubscribeToken = crypto.randomBytes(24).toString('hex');
      participant = await withPrismaRetry(() =>
        prisma.participant.create({
          data: {
            firstName,
            lastName,
            email: cleanEmail,
            phone: resolvedPhone,
            occupation: resolvedOccupation,
            organization: resolvedOrg,
            state: resolvedState,
            country: 'Nigeria',
            consentGiven: true,
            subscribed: false,
            unsubscribeToken,
          },
        })
      );
    }

    // 7. Prevent Duplicate Registration
    const existingRegistration = await withPrismaRetry(() =>
      prisma.registration.findUnique({
        where: {
          participantId_sessionId: {
            participantId: participant.id,
            sessionId: session.id,
          },
        },
      })
    );

    if (existingRegistration) {
      return res.status(409).json({
        error: 'Already Registered',
        message: `You are already registered for "${session.title}". Interactive session coordinates will be sent to your email prior to the start time.`,
      });
    }

    // 8. Create Session Registration with structured answers
    const registration = await withPrismaRetry(() =>
      prisma.registration.create({
        data: {
          participantId: participant.id,
          sessionId: session.id,
          answers: finalCleanedAnswers,
        },
      })
    );

    // 9. Dispatch Confirmation Email Asynchronously
    sendRegistrationConfirmation({
      participant,
      session,
      registrationId: registration.id,
    }).catch((mailErr) => {
      console.error('Failed to dispatch registration confirmation email:', mailErr);
    });

    return res.status(201).json({
      success: true,
      message: `Registration confirmed for "${session.title}". Check your inbox for confirmation details.`,
      data: {
        registrationId: registration.id,
        sessionTitle: session.title,
        sessionDate: session.sessionDate,
        venue: session.venue || 'Virtual Seminar',
        participant: {
          fullName: `${participant.firstName} ${participant.lastName}`.trim(),
          email: participant.email,
        },
        answers: finalCleanedAnswers,
      },
    });
  } catch (error) {
    console.error('Registration processing error:', error);
    return res.status(500).json({
      error: 'Registration Failed',
      message: 'An unexpected error occurred while processing your registration. Please try again.',
    });
  }
}
