import fs from 'fs';
import { prisma } from './api/_lib/prisma.js';

const BASE_URL = 'http://localhost:3000';

async function runParticipantTests() {
  console.log('\n======================================================');
  console.log('🧪 D MAAIN VOICE "BECOME A PARTICIPANT" TEST SUITE');
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

  // -----------------------------------------------------------
  // TEST 1: Frontend CTAs Verification (index.html Inspection)
  // -----------------------------------------------------------
  try {
    const html = fs.readFileSync('./index.html', 'utf8');

    const hasHeaderBtn = html.includes('id="header-become-participant-btn"') &&
      html.includes('>Become a Participant</button>');
    const hasHeroBtn = html.includes('id="hero-become-participant-btn"') &&
      html.includes('Become a Participant');
    const hasMobileBtn = html.includes('id="mobile-become-participant-btn"') &&
      html.includes('>Become a Participant</button>');
    const hasParticipantModal = html.includes('id="participant-modal"') &&
      html.includes('id="participant-registration-form"');

    const passed = hasHeaderBtn && hasHeroBtn && hasMobileBtn && hasParticipantModal;
    report(
      '1. Header & Hero "Become a Participant" CTAs in HTML',
      passed,
      `Header CTA: ${hasHeaderBtn}, Hero CTA: ${hasHeroBtn}, Mobile CTA: ${hasMobileBtn}, Modal: ${hasParticipantModal}`
    );
  } catch (err) {
    report('1. Header & Hero "Become a Participant" CTAs in HTML', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 2: Missing Full Name Validation
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: '',
        email: 'valid.email@example.com',
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error === 'Invalid Full Name';
    report('2. Missing Full Name Rejection', passed, `Status: ${res.status}, Error: "${data.message || data.error}"`);
  } catch (err) {
    report('2. Missing Full Name Rejection', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 3: Invalid Email Format Validation
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Halima Sadiq',
        email: 'invalid-email-no-at',
      }),
    });
    const data = await res.json();
    const passed = res.status === 400 && data.error === 'Invalid Email Format';
    report('3. Invalid Email Format Rejection', passed, `Status: ${res.status}, Error: "${data.message || data.error}"`);
  } catch (err) {
    report('3. Invalid Email Format Rejection', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 4: Successful Participant Registration (No Session Association)
  // -----------------------------------------------------------
  const testEmail = `community.participant.${Date.now()}@dmaainvoice.test`;
  const testFullName = 'Tariq Mansoor';
  let createdParticipantId = null;

  try {
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
      }),
    });
    const data = await res.json();
    createdParticipantId = data.data?.participantId;

    const passed =
      res.status === 201 &&
      data.success === true &&
      !!createdParticipantId &&
      data.data.fullName === testFullName &&
      data.data.email === testEmail;

    report('4. Successful Participant Registration (2 fields: fullName + email)', passed, `Status: ${res.status}, Participant ID: ${createdParticipantId}`);
  } catch (err) {
    report('4. Successful Participant Registration (2 fields: fullName + email)', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 5: Verify Database Record & Zero Session Registrations
  // -----------------------------------------------------------
  try {
    const participantInDb = await prisma.participant.findUnique({
      where: { email: testEmail },
      include: {
        registrations: true,
      },
    });

    const passed =
      !!participantInDb &&
      participantInDb.firstName === 'Tariq' &&
      participantInDb.lastName === 'Mansoor' &&
      participantInDb.consentGiven === true &&
      participantInDb.subscribed === true &&
      participantInDb.registrations.length === 0; // MUST BE ZERO!

    report(
      '5. PostgreSQL Persistence: In Participants Table & Zero Session Registrations',
      passed,
      `Participant: "${participantInDb?.firstName} ${participantInDb?.lastName}", Session Registrations Count: ${participantInDb?.registrations.length}`
    );
  } catch (err) {
    report('5. PostgreSQL Persistence: In Participants Table & Zero Session Registrations', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 6: Duplicate Participant Email Handling
  // -----------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: testFullName,
        email: testEmail,
      }),
    });
    const data = await res.json();
    const passed = res.status === 409 && data.error === 'Already Registered';
    report('6. Duplicate Participant Email Prevention', passed, `Status: ${res.status}, Message: "${data.message}"`);
  } catch (err) {
    report('6. Duplicate Participant Email Prevention', false, err.message);
  }

  // -----------------------------------------------------------
  // TEST 7: Clear Separation: Registering for a Session Afterward
  // -----------------------------------------------------------
  try {
    // When the participant later decides to register for a specific session via /api/register
    const upcomingSession = await prisma.session.findFirst({
      where: { status: 'UPCOMING' },
    });

    const sessionRes = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: upcomingSession.id,
        fullName: testFullName,
        email: testEmail,
      }),
    });
    const sessionData = await sessionRes.json();

    // Verify session registration succeeded
    const updatedParticipant = await prisma.participant.findUnique({
      where: { email: testEmail },
      include: { registrations: true },
    });

    const passed =
      sessionRes.status === 201 &&
      sessionData.success === true &&
      updatedParticipant.registrations.length === 1 &&
      updatedParticipant.registrations[0].sessionId === upcomingSession.id;

    report(
      '7. Separation Verified: Session Registration Flow Attaches Session Explicitly',
      passed,
      `Session Reg Status: ${sessionRes.status}, Registrations Count Now: ${updatedParticipant.registrations.length}`
    );
  } catch (err) {
    report('7. Separation Verified: Session Registration Flow Attaches Session Explicitly', false, err.message);
  }

  console.log('\n======================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('======================================================\n');

  await prisma.$disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runParticipantTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
