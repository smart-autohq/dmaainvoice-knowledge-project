import fs from 'fs';
import { prisma } from './api/_lib/prisma.js';

const BASE_URL = 'http://localhost:3000';

async function runConsentAndFlowTests() {
  console.log('\n================================================================');
  console.log('🧪 D MAAIN VOICE CONSENT, COMMUNITY & SESSION REGISTRATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function report(name, passed, detail = '') {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`✅ [PASS] ${name}${detail ? '\n         ↳ ' + detail : ''}`);
    } else {
      console.error(`❌ [FAIL] ${name}${detail ? '\n         ↳ ' + detail : ''}`);
    }
  }

  // 0. Fetch an active session for tests
  const session = await prisma.session.findFirst({
    where: { status: 'UPCOMING' },
  });

  if (!session) {
    console.error('No UPCOMING session found in database to run tests against.');
    process.exit(1);
  }

  const testSessionId = session.id;

  // -------------------------------------------------------------------------
  // TEST 1: Privacy Notes in HTML Reflect Actual Consent Behavior
  // -------------------------------------------------------------------------
  try {
    const html = fs.readFileSync('./index.html', 'utf8');

    const hasSessionConsentText = html.includes('This registration does not opt you into general marketing newsletters.');
    const hasCommunityConsentText = html.includes('consent to receive D Maain Voice knowledge updates, learning cohort invitations');

    const passed = hasSessionConsentText && hasCommunityConsentText;
    report(
      '1. Privacy Notes Wording Matches Actual Consent Behavior',
      passed,
      `Session note distinguishes marketing: ${hasSessionConsentText}, Community note describes cohort updates: ${hasCommunityConsentText}`
    );
  } catch (err) {
    report('1. Privacy Notes Wording Matches Actual Consent Behavior', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Session Registration Consent Default (subscribed === false)
  // -------------------------------------------------------------------------
  const sessionAttendeeEmail = `session.attendee.${Date.now()}@dmaainvoice.test`;
  const sessionAttendeeName = 'Farida Mohammed';

  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: sessionAttendeeName,
        email: sessionAttendeeEmail,
      }),
    });
    const data = await res.json();

    const participantInDb = await prisma.participant.findUnique({
      where: { email: sessionAttendeeEmail },
      include: { registrations: true },
    });

    const passed =
      res.status === 201 &&
      data.success === true &&
      participantInDb !== null &&
      participantInDb.consentGiven === true &&
      participantInDb.subscribed === false && // MUST BE FALSE: no automatic marketing opt-in!
      participantInDb.registrations.length === 1 &&
      participantInDb.registrations[0].sessionId === testSessionId;

    report(
      '2. Session Registration: Essential Consent Given, Marketing Subscribed Defaults to False',
      passed,
      `Status: ${res.status}, consentGiven: ${participantInDb?.consentGiven}, subscribed: ${participantInDb?.subscribed}, Session Regs: ${participantInDb?.registrations.length}`
    );
  } catch (err) {
    report('2. Session Registration: Essential Consent Given, Marketing Subscribed Defaults to False', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Existing Participant (from Session) Joins Community ("Become a Participant")
  // -------------------------------------------------------------------------
  try {
    // Participant registered above for a session (subscribed: false) now clicks "Become a Participant"
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: sessionAttendeeName,
        email: sessionAttendeeEmail,
      }),
    });
    const data = await res.json();

    const allMatchingParticipants = await prisma.participant.findMany({
      where: { email: sessionAttendeeEmail },
      include: { registrations: true },
    });

    const singleParticipant = allMatchingParticipants[0];
    const passed =
      res.status === 200 &&
      data.success === true &&
      allMatchingParticipants.length === 1 && // NO duplicate record!
      singleParticipant.subscribed === true && // Upgraded to community member!
      singleParticipant.registrations.length === 1; // Existing session registration preserved!

    report(
      '3. Existing Participant Joins Community: Reuses Record, Safe Upgrade to subscribed=true, Preserves Sessions',
      passed,
      `Status: ${res.status}, Total records for email: ${allMatchingParticipants.length}, subscribed now: ${singleParticipant?.subscribed}, Session Regs: ${singleParticipant?.registrations.length}`
    );
  } catch (err) {
    report('3. Existing Participant Joins Community: Reuses Record, Safe Upgrade to subscribed=true, Preserves Sessions', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Duplicate Community Registration Rejection
  // -------------------------------------------------------------------------
  try {
    // Participant is already an active community member; attempts community registration again
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: sessionAttendeeName,
        email: sessionAttendeeEmail,
      }),
    });
    const data = await res.json();

    const totalRecords = await prisma.participant.count({
      where: { email: sessionAttendeeEmail },
    });

    const passed =
      res.status === 409 &&
      data.error === 'Already Registered' &&
      totalRecords === 1;

    report(
      '4. Duplicate Community Registration Rejection',
      passed,
      `Status: ${res.status}, Error: "${data.error}", Message: "${data.message}", Total DB records: ${totalRecords}`
    );
  } catch (err) {
    report('4. Duplicate Community Registration Rejection', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Community-First Participant Registration (subscribed === true, 0 sessions)
  // -------------------------------------------------------------------------
  const communityMemberEmail = `community.first.${Date.now()}@dmaainvoice.test`;
  const communityMemberName = 'Aliyu Danjuma';

  try {
    const res = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: communityMemberName,
        email: communityMemberEmail,
      }),
    });
    const data = await res.json();

    const participantInDb = await prisma.participant.findUnique({
      where: { email: communityMemberEmail },
      include: { registrations: true },
    });

    const passed =
      res.status === 201 &&
      data.success === true &&
      participantInDb !== null &&
      participantInDb.consentGiven === true &&
      participantInDb.subscribed === true && // Community members explicitly opted into cohort updates
      participantInDb.registrations.length === 0; // Strictly zero sessions!

    report(
      '5. Community-First Registration: Subscribed=True and Strictly Zero Session Registrations',
      passed,
      `Status: ${res.status}, consentGiven: ${participantInDb?.consentGiven}, subscribed: ${participantInDb?.subscribed}, Session Regs Count: ${participantInDb?.registrations.length}`
    );
  } catch (err) {
    report('5. Community-First Registration: Subscribed=True and Strictly Zero Session Registrations', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Existing Community Participant Registers for a Session Later
  // -------------------------------------------------------------------------
  try {
    // Community participant later reserves a seat for a specific session via /api/register
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: communityMemberName,
        email: communityMemberEmail,
      }),
    });
    const data = await res.json();

    const allMatching = await prisma.participant.findMany({
      where: { email: communityMemberEmail },
      include: { registrations: true },
    });

    const participant = allMatching[0];
    const passed =
      res.status === 201 &&
      data.success === true &&
      allMatching.length === 1 && // NO duplicate participant record!
      participant.subscribed === true && // Marketing subscription PRESERVED!
      participant.registrations.length === 1 && // Now linked to the session
      participant.registrations[0].sessionId === testSessionId;

    report(
      '6. Existing Community Participant Registers for Session: Record Reused, Marketing Preference Preserved, Session Linked',
      passed,
      `Status: ${res.status}, Total records: ${allMatching.length}, subscribed preserved: ${participant?.subscribed}, Session Regs: ${participant?.registrations.length}`
    );
  } catch (err) {
    report('6. Existing Community Participant Registers for Session: Record Reused, Marketing Preference Preserved, Session Linked', false, err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Duplicate Session Registration Prevention
  // -------------------------------------------------------------------------
  try {
    // Attempting to register for the same session a 2nd time
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        fullName: communityMemberName,
        email: communityMemberEmail,
      }),
    });
    const data = await res.json();

    const passed =
      res.status === 409 &&
      data.error === 'Already Registered';

    report(
      '7. Duplicate Session Registration Rejection for Same Email & Session',
      passed,
      `Status: ${res.status}, Error: "${data.error}", Message: "${data.message}"`
    );
  } catch (err) {
    report('7. Duplicate Session Registration Rejection for Same Email & Session', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  await prisma.$disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runConsentAndFlowTests().catch(err => {
  console.error('Consent & flows test suite fatal error:', err);
  process.exit(1);
});
