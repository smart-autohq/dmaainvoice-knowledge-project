import { prisma, withPrismaRetry } from './api/_lib/prisma.js';

async function runTests() {
  console.log('=== STARTING REUSABLE REGISTRATION SYSTEM VERIFICATION ===\n');

  // Test 1: Fetch Halal Money Session questions
  console.log('--- Test 1: Fetch Halal Money Session Schema ---');
  const halalSession = await withPrismaRetry(() =>
    prisma.session.findFirst({
      where: { category: 'finance' },
    })
  );
  if (!halalSession) {
    throw new Error('Halal Money session not found in database');
  }

  const res1 = await fetch(`http://localhost:3000/api/questions?sessionId=${halalSession.id}`);
  const json1 = await res1.json();
  console.log(`HTTP ${res1.status} for session "${json1.data?.session?.title}"`);
  console.log(`Steps count: ${json1.data?.steps?.length}`);
  const halalQuestions = json1.data?.steps?.flatMap(s => s.questions) || [];
  const halalQuestionIds = halalQuestions.map(q => q.id);
  console.log('Questions found for Halal session:', halalQuestionIds);

  const hasGiveaway = halalQuestionIds.includes('q_giveaway');
  const hasFinanceFamiliarity = halalQuestionIds.includes('q_finance_familiarity');
  console.log(`✓ Has airtime giveaway question: ${hasGiveaway}`);
  console.log(`✓ Has Islamic finance question: ${hasFinanceFamiliarity}`);

  if (!hasGiveaway || !hasFinanceFamiliarity) {
    throw new Error('Halal Money session did not have its configured questions');
  }

  // Test 2: Create a separate session in another category (Technology track)
  console.log('\n--- Test 2: Verify Generalization for Non-Halal / Non-Finance Session ---');
  const organizer = await withPrismaRetry(() => prisma.organizer.findFirst());
  let techSession = await withPrismaRetry(() =>
    prisma.session.findFirst({
      where: { category: 'technology' },
    })
  );

  if (!techSession) {
    techSession = await prisma.session.create({
      data: {
        title: 'Building Resilient Microservices with Node.js & Docker',
        description: 'Hands-on architectural patterns for distributed backend engineering.',
        category: 'technology',
        format: 'Virtual Workshop',
        sessionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
        venue: 'Google Meet (Interactive)',
        organizerId: organizer.id,
      },
    });
    console.log(`Created test technology session: "${techSession.title}" (${techSession.id})`);
  }

  const res2 = await fetch(`http://localhost:3000/api/questions?sessionId=${techSession.id}`);
  const json2 = await res2.json();
  console.log(`HTTP ${res2.status} for session "${json2.data?.session?.title}"`);
  const techQuestions = json2.data?.steps?.flatMap(s => s.questions) || [];
  const techQuestionIds = techQuestions.map(q => q.id);
  console.log('Questions found for Technology session:', techQuestionIds);

  const techHasGiveaway = techQuestionIds.includes('q_giveaway');
  const techHasFinance = techQuestionIds.includes('q_finance_familiarity');
  const techHasTech = techQuestionIds.includes('q_tech_experience');

  console.log(`✓ Does NOT have giveaway question: ${!techHasGiveaway}`);
  console.log(`✓ Does NOT have Islamic finance question: ${!techHasFinance}`);
  console.log(`✓ Has Tech category questions: ${techHasTech}`);

  if (techHasGiveaway || techHasFinance || !techHasTech) {
    throw new Error('Technology session incorrectly displayed finance/giveaway questions or missed tech questions');
  }

  // Test 3: Perform registration for Halal Money session with full answers
  console.log('\n--- Test 3: Register for Halal Money Session with Answers ---');
  const testEmail1 = `attendee_${Date.now()}@test.org`;
  const regPayload1 = {
    sessionId: halalSession.id,
    fullName: 'Zainab Danjuma',
    email: testEmail1,
    phone: '+234 802 345 6789',
    occupation: 'Investment Analyst',
    organization: 'First City Capital',
    state: 'Kano',
    answers: {
      fullName: 'Zainab Danjuma',
      email: testEmail1,
      phone: '+234 802 345 6789',
      occupation: 'Investment Analyst',
      organization: 'First City Capital',
      state: 'Kano',
      q_finance_familiarity: 'Intermediate — Familiar with core principles (avoiding Riba, Gharar, and Maisir)',
      q_finance_interests: ['Halal Equities Screening & Shariah Stock Criteria', 'Sukuk (Islamic Fixed Income Bonds) & Sovereign Issues'],
      q_giveaway: 'Yes',
      q_giveaway_details: '08023456789 - Airtel',
      q_facilitator_qa: 'How should retail investors evaluate Shariah compliance in mixed-activity equities?',
    },
  };

  const regRes1 = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload1),
  });

  const regJson1 = await regRes1.json();
  console.log(`Registration HTTP ${regRes1.status}:`, regJson1.message || regJson1.error);

  if (regRes1.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regJson1)}`);
  }

  // Verify registration in database
  const savedReg1 = await withPrismaRetry(() =>
    prisma.registration.findUnique({
      where: { id: regJson1.data.registrationId },
      include: { participant: true, session: true },
    })
  );

  console.log('✓ Registration saved in DB with ID:', savedReg1.id);
  console.log('✓ Stored answers keys:', Object.keys(savedReg1.answers));
  console.log('✓ Giveaway response saved:', savedReg1.answers.q_giveaway_details);
  console.log('✓ Participant phone saved on profile:', savedReg1.participant.phone);

  // Test 4: Perform registration for Technology session with different answers
  console.log('\n--- Test 4: Register for Technology Session with Tech Answers ---');
  const testEmail2 = `dev_${Date.now()}@test.org`;
  const regPayload2 = {
    sessionId: techSession.id,
    fullName: 'Farouk Al-Hassan',
    email: testEmail2,
    phone: '+234 809 876 5432',
    occupation: 'Backend Developer',
    organization: 'PaySwitch Tech',
    state: 'Lagos',
    answers: {
      fullName: 'Farouk Al-Hassan',
      email: testEmail2,
      phone: '+234 809 876 5432',
      occupation: 'Backend Developer',
      organization: 'PaySwitch Tech',
      state: 'Lagos',
      q_tech_experience: 'Backend & Distributed Systems',
      q_tech_goals: ['Real-world enterprise system architecture', 'Hands-on debugging and problem-solving techniques'],
    },
  };

  const regRes2 = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload2),
  });

  const regJson2 = await regRes2.json();
  console.log(`Registration HTTP ${regRes2.status}:`, regJson2.message || regJson2.error);

  if (regRes2.status !== 201) {
    throw new Error(`Registration for tech session failed: ${JSON.stringify(regJson2)}`);
  }

  const savedReg2 = await withPrismaRetry(() =>
    prisma.registration.findUnique({
      where: { id: regJson2.data.registrationId },
      include: { participant: true, session: true },
    })
  );

  console.log('✓ Tech session registration saved in DB with ID:', savedReg2.id);
  console.log('✓ Stored tech answers:', savedReg2.answers.q_tech_experience);

  // Test 5: Verify Duplicate Protection
  console.log('\n--- Test 5: Duplicate Protection Test ---');
  const dupRes = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload1),
  });
  console.log(`Duplicate response status: ${dupRes.status} (Expected: 409)`);
  if (dupRes.status !== 409) {
    throw new Error(`Expected 409 for duplicate registration, got ${dupRes.status}`);
  }

  console.log('\n=== ALL GENERALIZATION & SYSTEM TESTS PASSED SUCCESSFULLY! ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
