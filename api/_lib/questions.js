import { prisma } from './prisma.js';
import { getCategoryLabel } from './categories.js';

export const DEFAULT_QUESTIONS_CONFIG = {
  commonQuestions: [
    {
      id: 'fullName',
      label: 'Full Name',
      type: 'text',
      placeholder: 'e.g. Amina Bello',
      helperText: 'Your name as you would like it to appear on attendance rosters and certificates.',
      required: true,
      minLength: 2,
    },
    {
      id: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'e.g. amina@example.com',
      helperText: 'Interactive session coordinates, Google Meet links, and materials will be sent here.',
      required: true,
    },
    {
      id: 'phone',
      label: 'WhatsApp / Mobile Number',
      type: 'tel',
      placeholder: 'e.g. +234 803 123 4567',
      helperText: 'Used for live event notifications and cohort reminders.',
      required: true,
      minLength: 7,
    },
    {
      id: 'occupation',
      label: 'Occupation / Field of Practice',
      type: 'text',
      placeholder: 'e.g. Software Engineer, Financial Analyst, Student',
      helperText: 'Helps our facilitators calibrate discussions to attendee backgrounds.',
      required: false,
    },
    {
      id: 'organization',
      label: 'Organization / Institution',
      type: 'text',
      placeholder: 'e.g. Sterling Bank, University of Lagos, Freelance',
      helperText: 'Your current company, firm, startup, or educational institution.',
      required: false,
    },
    {
      id: 'state',
      label: 'State / Location of Residence',
      type: 'text',
      placeholder: 'e.g. Lagos, Abuja, Kano, Oyo, International',
      helperText: 'To help us understand our geographic reach and timezone requirements.',
      required: false,
    },
  ],
  categoryQuestions: {
    finance: [
      {
        id: 'q_finance_familiarity',
        label: 'Level of Familiarity with Islamic Finance & Ethical Wealth',
        type: 'radio',
        helperText: 'Select the option that best reflects your current knowledge.',
        required: true,
        options: [
          'Beginner — Completely new to Halal & Islamic finance concepts',
          'Intermediate — Familiar with core principles (avoiding Riba, Gharar, and Maisir)',
          'Advanced — Actively investing in or managing Shariah-compliant assets',
        ],
      },
      {
        id: 'q_finance_interests',
        label: 'Which Halal Wealth topics are you most eager to explore?',
        type: 'checkbox',
        helperText: 'Select all areas of interest that apply.',
        required: false,
        allowOther: true,
        options: [
          'Halal Equities Screening & Shariah Stock Criteria',
          'Sukuk (Islamic Fixed Income Bonds) & Sovereign Issues',
          'Ethical Real Estate & Asset-Backed Financing',
          'Takaful (Islamic Cooperative Insurance) Models',
          'Zakat Calculation, Purification & Islamic Wealth Planning',
        ],
      },
    ],
    technology: [
      {
        id: 'q_tech_experience',
        label: 'Primary Technical Focus Area',
        type: 'radio',
        helperText: 'Select your main discipline.',
        required: false,
        options: [
          'Frontend Engineering & UI/UX Architecture',
          'Backend & Distributed Systems',
          'Cloud Infrastructure & DevOps',
          'Data Engineering, AI & Machine Learning',
          'Technical Product Management & Systems Design',
        ],
      },
      {
        id: 'q_tech_goals',
        label: 'Key Technical Objectives for this Session',
        type: 'checkbox',
        helperText: 'What outcomes would make this session most valuable for you?',
        required: false,
        allowOther: true,
        options: [
          'Deep architectural insights & best practices',
          'Hands-on debugging and problem-solving techniques',
          'Navigating senior engineering career growth',
          'Networking with like-minded technical practitioners',
        ],
      },
    ],
    business: [
      {
        id: 'q_biz_stage',
        label: 'Current Business Stage',
        type: 'radio',
        helperText: 'Select your business journey stage.',
        required: false,
        options: [
          'Aspiring / Ideation Stage',
          'Early-stage Startup (< 2 years)',
          'Growing SME / Established Business',
          'Corporate / Advisory',
        ],
      },
    ],
  },
  sessionQuestions: {
    // Configured for Halal Money session
    cmvh2p1800004kklwwkqs9len: [
      {
        id: 'q_giveaway',
        label: 'Would you like to participate in the interactive session airtime giveaway?',
        type: 'radio',
        helperText: 'Active live participants qualify for special cohort airtime rewards.',
        required: true,
        options: ['Yes', 'No'],
      },
      {
        id: 'q_giveaway_details',
        label: 'Giveaway Phone Number & Network Provider',
        type: 'text',
        placeholder: 'e.g. 08031234567 - MTN',
        helperText: 'Please provide the number and telecom network to receive the airtime.',
        required: true,
        dependsOn: {
          questionId: 'q_giveaway',
          value: 'Yes',
        },
      },
      {
        id: 'q_facilitator_qa',
        label: 'Specific Question for the Facilitator',
        type: 'textarea',
        placeholder: 'What question or real-world scenario would you like the facilitator to address?',
        helperText: 'Curated questions will be prioritized during the dedicated Q&A session.',
        required: false,
      },
    ],
  },
};

/**
 * Retrieve the active question configuration from the database, falling back to defaults.
 */
export async function getQuestionsConfig() {
  try {
    const record = await prisma.siteContent.findUnique({
      where: { key: 'registration_questions' },
    });

    if (record && record.value && typeof record.value === 'object') {
      const dbConfig = record.value;
      return {
        commonQuestions: Array.isArray(dbConfig.commonQuestions)
          ? dbConfig.commonQuestions
          : DEFAULT_QUESTIONS_CONFIG.commonQuestions,
        categoryQuestions:
          dbConfig.categoryQuestions && typeof dbConfig.categoryQuestions === 'object'
            ? dbConfig.categoryQuestions
            : DEFAULT_QUESTIONS_CONFIG.categoryQuestions,
        sessionQuestions:
          dbConfig.sessionQuestions && typeof dbConfig.sessionQuestions === 'object'
            ? dbConfig.sessionQuestions
            : DEFAULT_QUESTIONS_CONFIG.sessionQuestions,
      };
    }

    // Initialize in DB if first time
    await prisma.siteContent.upsert({
      where: { key: 'registration_questions' },
      update: { value: DEFAULT_QUESTIONS_CONFIG },
      create: { key: 'registration_questions', value: DEFAULT_QUESTIONS_CONFIG },
    }).catch((e) => console.warn('Could not auto-seed registration_questions:', e.message));

    return DEFAULT_QUESTIONS_CONFIG;
  } catch (error) {
    console.warn('Error reading registration_questions from database:', error.message);
    return DEFAULT_QUESTIONS_CONFIG;
  }
}

/**
 * Persist updated question configuration to Neon database.
 */
export async function saveQuestionsConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid questions configuration payload');
  }

  const sanitized = {
    commonQuestions: Array.isArray(config.commonQuestions) ? config.commonQuestions : [],
    categoryQuestions:
      config.categoryQuestions && typeof config.categoryQuestions === 'object'
        ? config.categoryQuestions
        : {},
    sessionQuestions:
      config.sessionQuestions && typeof config.sessionQuestions === 'object'
        ? config.sessionQuestions
        : {},
  };

  const updated = await prisma.siteContent.upsert({
    where: { key: 'registration_questions' },
    update: { value: sanitized },
    create: { key: 'registration_questions', value: sanitized },
  });

  return updated.value;
}

/**
 * Build dynamic multi-step form schema for a given session.
 */
export async function buildFormSchemaForSession(session) {
  const config = await getQuestionsConfig();

  const common = config.commonQuestions || [];
  const categorySlug = (session.category || '').toLowerCase().trim();
  const categoryQuestions = (config.categoryQuestions && config.categoryQuestions[categorySlug]) || [];
  const sessionQuestions = (config.sessionQuestions && config.sessionQuestions[session.id]) || [];

  const combinedCustomQuestions = [...categoryQuestions, ...sessionQuestions];

  const steps = [];

  // Step 1: Participant Profile
  steps.push({
    id: 'step_profile',
    title: 'Participant Profile',
    subtitle: 'Basic contact information for event credentials and communications',
    questions: common,
  });

  // Step 2: Track & Session Inquiries (only if any exist)
  if (combinedCustomQuestions.length > 0) {
    steps.push({
      id: 'step_questions',
      title: 'Session & Track Focus',
      subtitle: `Specific questions for the ${getCategoryLabel(session.category)} track`,
      questions: combinedCustomQuestions,
    });
  }

  // Step 3: Review & Confirmation
  steps.push({
    id: 'step_review',
    title: 'Review & Confirmation',
    subtitle: 'Please review your details before submitting your registration',
    questions: [],
  });

  return {
    session: {
      id: session.id,
      title: session.title,
      category: session.category,
      categoryLabel: getCategoryLabel(session.category),
      format: session.format,
      venue: session.venue || 'Virtual Seminar',
      sessionDate: session.sessionDate,
      timeZone: session.timeZone || 'Africa/Lagos',
      facilitator: session.facilitator
        ? {
            id: session.facilitator.id,
            name: session.facilitator.name,
            title: session.facilitator.title,
          }
        : null,
      status: session.status,
      capacity: session.capacity,
    },
    steps,
  };
}

/**
 * Validate submitted answers against configured question definitions.
 */
export function validateSubmittedAnswers(questionsList, answers) {
  const errors = {};
  const cleanedAnswers = {};

  for (const q of questionsList) {
    const qId = q.id;
    let val = answers ? answers[qId] : undefined;

    // Check conditional visibility
    if (q.dependsOn && q.dependsOn.questionId) {
      const parentVal = answers ? answers[q.dependsOn.questionId] : undefined;
      const expectedVal = q.dependsOn.value;
      const isVisible =
        Array.isArray(parentVal) ? parentVal.includes(expectedVal) : parentVal === expectedVal;

      if (!isVisible) {
        // Dependent question is not applicable, skip validation and don't require
        continue;
      }
    }

    // Required check
    if (q.required) {
      if (val === undefined || val === null || val === '') {
        errors[qId] = `${q.label} is required.`;
        continue;
      }
      if (Array.isArray(val) && val.length === 0) {
        errors[qId] = `Please select at least one option for ${q.label}.`;
        continue;
      }
    }

    // Type-specific validations
    if (val !== undefined && val !== null && val !== '') {
      if (q.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof val !== 'string' || !emailRegex.test(val.trim())) {
          errors[qId] = 'Please provide a valid email address.';
        } else {
          cleanedAnswers[qId] = val.trim().toLowerCase();
        }
      } else if (q.type === 'tel') {
        const cleanTel = String(val).trim();
        if (cleanTel.length < (q.minLength || 7)) {
          errors[qId] = 'Please enter a valid phone number with country/area code.';
        } else {
          cleanedAnswers[qId] = cleanTel;
        }
      } else if (q.type === 'checkbox') {
        if (!Array.isArray(val)) {
          val = [val];
        }
        cleanedAnswers[qId] = val;
      } else if (typeof val === 'string') {
        cleanedAnswers[qId] = val.trim();
      } else {
        cleanedAnswers[qId] = val;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanedAnswers,
  };
}
