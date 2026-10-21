import { prisma } from './api/_lib/prisma.js';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 D MAAIN VOICE REGISTRATION FLOW TEST SUITE');
  console.log('======================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function report(name, passed, detail = '') {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`✅ [PASS] ${name}${detail ? ' — ' + detail : ''}`);
    } else {
      console.error(`❌ [FAIL] ${name}${detail ? ' — ' + detail : ''}`);
    }
  }

  // 0. Fetch an active test session
  const session = await prisma.session.findFirst({
    where: { status: 'UPCOMING' },
  });

  if (!session) {
    console.error('No UPCOMING session found in database to run tests against.');
    process.exit(1);
  }

  const testSessionId = session.id;
  const testEmail = `test.attendee.${Date.now()}@dmaainvoice.test`;
  const testFullName = 'Zainab Abdullahi';

  console.log(`Using Session: "${session.title}" (ID: ${testSessionId})\n`);

  // -----------------------------------------------------------
  // TEST 1: Missing Fields (Missing fullName)
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: '',
        email: testEmail,
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error === 'Invalid Full Name';
    report('1. Missing Full Name Validation', passed, `Status: ${res.status}, Error: "${data.message || data.error}"`);
  } catch (err) {
    report('1. Missing Full Name Validation', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 2: Missing Fields (Missing Email)
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: testFullName,
        email: '',
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error === 'Missing Email';
    report('2. Missing Email Validation', passed, `Status: ${res.status}, Error: "${data.message || data.error}"`);
  } catch (err) {
    report('2. Missing Email Validation', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 3: Invalid Email Format
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: testFullName,
        email: 'invalid-not-an-email',
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error === 'Invalid Email Format';
    report('3. Invalid Email Format Rejection', passed, `Status: ${res.status}, Error: "${data.message || data.error}"`);
  } catch (err) {
    report('3. Invalid Email Format Rejection', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 4: Successful Registration (Only full name + email)
  // -----------------------------------------------------------
  let createdRegistrationId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: testFullName,
        email: testEmail,
      }),
    });
    const data = await res.json();
    createdRegistrationId = data.data?.registrationId;
    const passed = res.status === 201 && data.success === true && !!createdRegistrationId;
    report('4. Successful Registration (2 fields: fullName + email)', passed, `Status: ${res.status}, RegID: ${createdRegistrationId}`);
  } catch (err) {
    report('4. Successful Registration (2 fields: fullName + email)', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 5: Prevent Duplicate Registration (Same email & session)
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: testFullName,
        email: testEmail,
      }),
    });
    const data = await res.json();
    const passed = res.status === 409 && data.error === 'Already Registered';
    report('5. Duplicate Registration Prevention', passed, `Status: ${res.status}, Message: "${data.message}"`);
  } catch (err) {
    report('5. Duplicate Registration Prevention', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 6: Session Capacity Limits
  // -----------------------------------------------------------
  let capacityTestSession = null;
  try {
    // Create a temporary session with capacity = 1
    const organizer = await prisma.organizer.findFirst();
    capacityTestSession = await prisma.session.create({
      data: {
        title: `Capacity Limit Test Session ${Date.now()}`,
        description: 'Temporary session to verify capacity limit enforcement.',
        sessionDate: new Date(Date.now() + 86400000 * 7),
        capacity: 1,
        status: 'UPCOMING',
        category: 'technology',
        organizerId: organizer.id,
      },
    });

    // 1st registration should succeed
    const firstRes = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: capacityTestSession.id,
        fullName: 'Attendee One',
        email: `attendee.one.${Date.now()}@example.com`,
      }),
    });
    const firstData = await firstRes.json();

    // 2nd registration should fail with 400 Session Full
    const secondRes = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: capacityTestSession.id,
        fullName: 'Attendee Two',
        email: `attendee.two.${Date.now()}@example.com`,
      }),
    });
    const secondData = await secondRes.json();

    const passed =
      firstRes.status === 201 &&
      secondRes.status === 400 &&
      secondData.error === 'Session Full';

    report('6. Session Capacity Limits Enforcement', passed, `1st Reg: ${firstRes.status}, 2nd Reg: ${secondRes.status} (${secondData.message})`);
  } catch (err) {
    report('6. Session Capacity Limits Enforcement', false, err.message);
  } finally {
    // Cleanup temporary capacity test session
    if (capacityTestSession) {
      await prisma.registration.deleteMany({ where: { sessionId: capacityTestSession.id } });
      await prisma.session.delete({ where: { id: capacityTestSession.id } });
    }
  }

  // -----------------------------------------------------------
  // TEST 7: Public API Endpoints Do Not Expose Private Data
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/sessions`);
    const json = await res.json();
    const publicSessions = json.data || [];

    // Verify no participant emails, phones, or participant lists exist in the public output
    const jsonString = JSON.stringify(publicSessions);
    const hasExposedEmail = jsonString.includes(testEmail);
    const hasParticipantList = publicSessions.some(s => s.participants !== undefined || s.registrations !== undefined);

    const passed = !hasExposedEmail && !hasParticipantList;
    report('7. Public Sessions API Privacy Shield', passed, `Participant emails/lists hidden: ${passed}`);
  } catch (err) {
    report('7. Public Sessions API Privacy Shield', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 8: Neon PostgreSQL Database & Organizer Dashboard Verification
  // -----------------------------------------------------------
  try {
    const participantInDb = await prisma.participant.findUnique({
      where: { email: testEmail },
      include: {
        registrations: {
          include: { session: true },
        },
      },
    });

    const passed =
      !!participantInDb &&
      participantInDb.firstName === 'Zainab' &&
      participantInDb.lastName === 'Abdullahi' &&
      participantInDb.consentGiven === true &&
      participantInDb.subscribed === false &&
      participantInDb.registrations.length > 0 &&
      participantInDb.registrations[0].sessionId === testSessionId;

    report(
      '8. Neon PostgreSQL Data Persistence & Schema Mapping',
      passed,
      `Stored: "${participantInDb.firstName} ${participantInDb.lastName}", Email: ${participantInDb.email}, Consent: ${participantInDb.consentGiven}, Subscribed: ${participantInDb.subscribed}`
    );
  } catch (err) {
    report('8. Neon PostgreSQL Data Persistence & Schema Mapping', false, err.message);
  }

  console.log('\n======================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('======================================================\n');

  await prisma.$disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
