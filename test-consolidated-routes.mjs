import { prisma } from './api/_lib/prisma.js';
import { signToken, comparePassword } from './api/_lib/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

async function runRegressionSuite() {
  console.log('=================================================================');
  console.log('   D MAAIN VOICE - COMPREHENSIVE CONSOLIDATED API REGRESSION TEST');
  console.log('=================================================================\n');

  // 1. Get an existing organizer for auth tests
  const organizer = await prisma.organizer.findFirst();
  if (!organizer) {
    throw new Error('No organizer found in database to execute tests.');
  }

  const validToken = signToken({
    id: organizer.id,
    email: organizer.email,
    name: organizer.name,
    role: organizer.role,
  });

  const authHeader = {
    'Authorization': `Bearer ${validToken}`,
    'Content-Type': 'application/json',
  };

  const createdSessionIds = [];
  const createdFacilitatorIds = [];
  const createdCampaignIds = [];
  const createdParticipantIds = [];

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: AUTHENTICATION GATEWAY (/api/auth/[action])
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 1: Auth Gateway (/api/auth/[action]) ---');

    // 1A. /api/auth/me with valid Bearer token
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeader });
    const meData = await meRes.json();
    console.log(`[PASS] GET /api/auth/me (authenticated): Status ${meRes.status}, Email: ${meData.organizer?.email}`);
    if (meRes.status !== 200 || !meData.organizer) throw new Error('GET /api/auth/me failed');

    // 1B. /api/auth/me without token (Unauthorized check)
    const meUnauth = await fetch(`${BASE_URL}/api/auth/me`);
    console.log(`[PASS] GET /api/auth/me (unauthenticated): Status ${meUnauth.status} (Expected 401)`);
    if (meUnauth.status !== 401) throw new Error('Unauthenticated /api/auth/me did not return 401');

    // 1C. /api/auth/login validation (missing fields)
    const loginEmpty = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    console.log(`[PASS] POST /api/auth/login (missing fields): Status ${loginEmpty.status} (Expected 400)`);
    if (loginEmpty.status !== 400) throw new Error('Empty login payload did not return 400');

    // 1D. /api/auth/login invalid credentials
    const loginInvalid = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrongpassword' }),
    });
    console.log(`[PASS] POST /api/auth/login (invalid creds): Status ${loginInvalid.status} (Expected 401)`);
    if (loginInvalid.status !== 401) throw new Error('Invalid credentials did not return 401');

    // 1E. /api/auth/logout
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
    const cookieHeader = logoutRes.headers.get('set-cookie') || '';
    console.log(`[PASS] POST /api/auth/logout: Status ${logoutRes.status}, Cookie cleared: ${cookieHeader.includes('Max-Age=0')}`);
    if (logoutRes.status !== 200 || !cookieHeader.includes('Max-Age=0')) throw new Error('Logout failed to clear cookie');

    // 1F. Invalid auth action (404 check)
    const invalidAuthAction = await fetch(`${BASE_URL}/api/auth/nonexistent-action`);
    console.log(`[PASS] GET /api/auth/nonexistent-action: Status ${invalidAuthAction.status} (Expected 404)`);
    if (invalidAuthAction.status !== 404) throw new Error('Invalid auth action did not return 404');


    // -------------------------------------------------------------------------
    // TEST SUITE 2: ADMIN CATCH-ALL GATEWAY (/api/admin/[...slug])
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Admin Gateway (/api/admin/[...slug]) ---');

    // 2A. Unauthorized check on admin routes
    const overviewUnauth = await fetch(`${BASE_URL}/api/admin/overview`);
    console.log(`[PASS] GET /api/admin/overview (unauthorized): Status ${overviewUnauth.status} (Expected 401)`);
    if (overviewUnauth.status !== 401) throw new Error('Unauthenticated admin request did not return 401');

    // 2B. GET /api/admin/overview
    const overviewRes = await fetch(`${BASE_URL}/api/admin/overview`, { headers: authHeader });
    const overviewData = await overviewRes.json();
    console.log(`[PASS] GET /api/admin/overview: Status ${overviewRes.status}, Total Sessions in metrics: ${overviewData.data?.metrics?.totalSessions}`);
    if (overviewRes.status !== 200 || !overviewData.data?.metrics) throw new Error('Admin overview failed');

    // 2C. Sessions CRUD
    // Create session
    const createSessionRes = await fetch(`${BASE_URL}/api/admin/sessions`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        title: `Regression Test Session ${Date.now()}`,
        description: 'Verifying consolidated admin router session creation.',
        category: 'finance',
        sessionDate: new Date(Date.now() + 86400000 * 10).toISOString(),
        venue: 'Virtual Room A',
        capacity: 100,
        status: 'UPCOMING',
      }),
    });
    const createSessionData = await createSessionRes.json();
    const sessionId = createSessionData.data?.id;
    if (!sessionId) throw new Error(`Create session failed: ${JSON.stringify(createSessionData)}`);
    createdSessionIds.push(sessionId);
    console.log(`[PASS] POST /api/admin/sessions: Created session ${sessionId} (${createSessionData.data.categoryLabel})`);

    // List sessions
    const listSessionsRes = await fetch(`${BASE_URL}/api/admin/sessions`, { headers: authHeader });
    const listSessionsData = await listSessionsRes.json();
    const foundInList = (listSessionsData.data || []).some(s => s.id === sessionId);
    console.log(`[PASS] GET /api/admin/sessions: Found created session in list: ${foundInList}`);
    if (!foundInList) throw new Error('Created session not found in admin list');

    // Get session detail
    const getSessionDetailRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}`, { headers: authHeader });
    const sessionDetailData = await getSessionDetailRes.json();
    console.log(`[PASS] GET /api/admin/sessions/${sessionId}: Returned session title: "${sessionDetailData.data?.title}"`);
    if (getSessionDetailRes.status !== 200 || !sessionDetailData.data) throw new Error('Get session detail failed');

    // Update session (PUT)
    const updateSessionRes = await fetch(`${BASE_URL}/api/admin/sessions/${sessionId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        category: 'business',
        venue: 'Updated Virtual Auditorium',
      }),
    });
    const updateSessionData = await updateSessionRes.json();
    console.log(`[PASS] PUT /api/admin/sessions/${sessionId}: Category updated to "${updateSessionData.data?.category}" (${updateSessionData.data?.categoryLabel})`);
    if (updateSessionData.data?.category !== 'business' || updateSessionData.data?.categoryLabel !== 'Business') {
      throw new Error('Update session category failed');
    }

    // 2D. Facilitators CRUD
    const createFacRes = await fetch(`${BASE_URL}/api/admin/facilitators`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: `Test Facilitator ${Date.now()}`,
        title: 'Senior Domain Fellow',
        bio: 'Comprehensive bio for regression testing consolidated facilitators handler.',
        expertise: ['Technology', 'Ethics'],
      }),
    });
    const createFacData = await createFacRes.json();
    const facId = createFacData.data?.id;
    if (!facId) throw new Error(`Create facilitator failed: ${JSON.stringify(createFacData)}`);
    createdFacilitatorIds.push(facId);
    console.log(`[PASS] POST /api/admin/facilitators: Created facilitator ${facId}`);

    // Update facilitator (PUT)
    const updateFacRes = await fetch(`${BASE_URL}/api/admin/facilitators`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        id: facId,
        title: 'Lead Domain Scholar & Fellow',
      }),
    });
    console.log(`[PASS] PUT /api/admin/facilitators: Status ${updateFacRes.status}`);
    if (updateFacRes.status !== 200) throw new Error('Update facilitator failed');

    // List facilitators
    const listFacRes = await fetch(`${BASE_URL}/api/admin/facilitators`, { headers: authHeader });
    const listFacData = await listFacRes.json();
    const facFound = (listFacData.data || []).some(f => f.id === facId);
    console.log(`[PASS] GET /api/admin/facilitators: Found facilitator in roster: ${facFound}`);
    if (!facFound) throw new Error('Facilitator not found in list');

    // 2E. Participants & CSV Export
    const participantsRes = await fetch(`${BASE_URL}/api/admin/participants`, { headers: authHeader });
    const participantsData = await participantsRes.json();
    console.log(`[PASS] GET /api/admin/participants: Status 200, count: ${participantsData.count}`);
    if (participantsRes.status !== 200) throw new Error('Get participants failed');

    // CSV format
    const csvRes = await fetch(`${BASE_URL}/api/admin/participants?format=csv`, { headers: authHeader });
    const csvContent = await csvRes.text();
    console.log(`[PASS] GET /api/admin/participants?format=csv: Content-Type "${csvRes.headers.get('content-type')}", CSV Header matches: ${csvContent.startsWith('ID,First Name')}`);
    if (!csvContent.startsWith('ID,First Name')) throw new Error('Participants CSV export failed');

    // 2F. Campaigns (Draft creation)
    const createCampRes = await fetch(`${BASE_URL}/api/admin/campaigns`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        subject: `Test Campaign ${Date.now()}`,
        body: 'Regression test email campaign body.',
        sessionId: sessionId,
      }),
    });
    const createCampData = await createCampRes.json();
    const campId = createCampData.data?.id;
    if (!campId) throw new Error(`Create campaign failed: ${JSON.stringify(createCampData)}`);
    createdCampaignIds.push(campId);
    console.log(`[PASS] POST /api/admin/campaigns: Drafted campaign ${campId}`);

    // List campaigns
    const listCampRes = await fetch(`${BASE_URL}/api/admin/campaigns`, { headers: authHeader });
    const listCampData = await listCampRes.json();
    const campFound = (listCampData.data || []).some(c => c.id === campId);
    console.log(`[PASS] GET /api/admin/campaigns: Campaign listed in drafts: ${campFound}`);
    if (!campFound) throw new Error('Campaign not found in list');

    // 2G. Content (GET & PUT)
    const contentGetRes = await fetch(`${BASE_URL}/api/admin/content`, { headers: authHeader });
    console.log(`[PASS] GET /api/admin/content: Status ${contentGetRes.status}`);
    if (contentGetRes.status !== 200) throw new Error('Admin get content failed');

    // 2H. Non-existent admin route (404 check)
    const notFoundAdmin = await fetch(`${BASE_URL}/api/admin/completely/fake/path`, { headers: authHeader });
    console.log(`[PASS] GET /api/admin/completely/fake/path: Status ${notFoundAdmin.status} (Expected 404)`);
    if (notFoundAdmin.status !== 404) throw new Error('Non-existent admin route did not return 404');


    // -------------------------------------------------------------------------
    // TEST SUITE 3: PUBLIC API ENDPOINTS & REWRITES
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Public Endpoints & Registration ---');

    // 3A. Public Sessions List & Category Filter
    const publicSessionsRes = await fetch(`${BASE_URL}/api/sessions`);
    const publicSessionsData = await publicSessionsRes.json();
    console.log(`[PASS] GET /api/sessions: Status 200, count: ${publicSessionsData.count}`);
    if (publicSessionsRes.status !== 200) throw new Error('Public sessions list failed');

    // Filter by business (should find our created session)
    const businessFilterRes = await fetch(`${BASE_URL}/api/sessions?category=business`);
    const businessFilterData = await businessFilterRes.json();
    const inBusinessFilter = (businessFilterData.data || []).some(s => s.id === sessionId);
    console.log(`[PASS] GET /api/sessions?category=business: Session found in filter: ${inBusinessFilter}`);
    if (!inBusinessFilter) throw new Error('Business category filter failed');

    // 3B. Public Facilitators
    const publicFacRes = await fetch(`${BASE_URL}/api/facilitators`);
    const publicFacData = await publicFacRes.json();
    console.log(`[PASS] GET /api/facilitators: Status 200, count: ${publicFacData.count}`);
    if (publicFacRes.status !== 200) throw new Error('Public facilitators list failed');

    // 3C. Public Content
    const publicContentRes = await fetch(`${BASE_URL}/api/content`);
    console.log(`[PASS] GET /api/content: Status ${publicContentRes.status}`);
    if (publicContentRes.status !== 200) throw new Error('Public content failed');

    // 3D. General Participant Join via /api/participants
    const testEmail = `attendee.regression.${Date.now()}@example.com`;
    const participantRes = await fetch(`${BASE_URL}/api/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Regression Tester',
        email: testEmail,
      }),
    });
    const participantData = await participantRes.json();
    const partId = participantData.data?.participantId;
    if (partId) createdParticipantIds.push(partId);
    console.log(`[PASS] POST /api/participants: Registered community attendee ${testEmail}`);
    if (participantRes.status !== 200 && participantRes.status !== 201) throw new Error('Participant join failed');

    // 3E. Rewrite test: /api/join -> /api/participants
    const joinRewriteRes = await fetch(`${BASE_URL}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rewrite AliasTester',
        email: `join.alias.${Date.now()}@example.com`,
      }),
    });
    const joinRewriteData = await joinRewriteRes.json();
    if (joinRewriteData.data?.participantId) createdParticipantIds.push(joinRewriteData.data.participantId);
    console.log(`[PASS] POST /api/join (rewrite alias): Status ${joinRewriteRes.status}, Message: "${joinRewriteData.message}"`);
    if (joinRewriteRes.status !== 200 && joinRewriteRes.status !== 201) throw new Error('/api/join rewrite failed');

    // 3F. Session Seat Reservation via /api/register
    const registerRes = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        fullName: 'Regression Seat Holder',
        email: testEmail,
        consentGiven: true,
      }),
    });
    const registerData = await registerRes.json();
    const regId = registerData.registration?.id;
    console.log(`[PASS] POST /api/register: Successfully reserved seat (Registration ID: ${regId})`);
    if (registerRes.status !== 200 && registerRes.status !== 201) throw new Error('Session registration failed');

    // 3G. Admin Attendance Toggle for that registration
    if (regId) {
      const attendRes = await fetch(`${BASE_URL}/api/admin/registrations/${regId}`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ attended: true }),
      });
      const attendData = await attendRes.json();
      console.log(`[PASS] PUT /api/admin/registrations/${regId}: Attended marked as ${attendData.data?.attended}`);
      if (!attendData.data?.attended) throw new Error('Attendance update failed');
    }

    // 3H. Unsubscribe endpoint verification
    const unsubsEmptyRes = await fetch(`${BASE_URL}/api/unsubscribe`);
    const unsubsEmptyHtml = await unsubsEmptyRes.text();
    console.log(`[PASS] GET /api/unsubscribe (no token): Status ${unsubsEmptyRes.status}, Expected warning: ${unsubsEmptyHtml.includes('Invalid Unsubscribe Link')}`);
    if (unsubsEmptyRes.status !== 400 || !unsubsEmptyHtml.includes('Invalid Unsubscribe Link')) {
      throw new Error('Unsubscribe without token did not return warning page');
    }

    const unsubsInvalidRes = await fetch(`${BASE_URL}/api/unsubscribe?token=completely_fake_invalid_token_12345`);
    const unsubsInvalidHtml = await unsubsInvalidRes.text();
    console.log(`[PASS] GET /api/unsubscribe (invalid token): Status ${unsubsInvalidRes.status}, Not found warning: ${unsubsInvalidHtml.includes('Unsubscribe Request Not Found')}`);
    if (unsubsInvalidRes.status !== 404 || !unsubsInvalidHtml.includes('Unsubscribe Request Not Found')) {
      throw new Error('Unsubscribe with fake token did not return 404 page');
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 4: CLEANUP OF TEST ARTIFACTS
    // -------------------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing Test Entities ---');

    // Delete created campaign
    for (const cId of createdCampaignIds) {
      await prisma.emailCampaign.delete({ where: { id: cId } }).catch(() => {});
      console.log(`  ✓ Cleaned test campaign ${cId}`);
    }

    // Delete created facilitator
    for (const fId of createdFacilitatorIds) {
      await prisma.facilitator.delete({ where: { id: fId } }).catch(() => {});
      console.log(`  ✓ Cleaned test facilitator ${fId}`);
    }

    // Delete created session
    for (const sId of createdSessionIds) {
      await prisma.registration.deleteMany({ where: { sessionId: sId } }).catch(() => {});
      await prisma.session.delete({ where: { id: sId } }).catch(() => {});
      console.log(`  ✓ Cleaned test session ${sId}`);
    }

    // Delete created participants
    for (const pId of createdParticipantIds) {
      await prisma.registration.deleteMany({ where: { participantId: pId } }).catch(() => {});
      await prisma.participant.delete({ where: { id: pId } }).catch(() => {});
      console.log(`  ✓ Cleaned test participant ${pId}`);
    }

    console.log('\n=================================================================');
    console.log('   ALL CONSOLIDATED API REGRESSION TESTS PASSED (100% SUCCESS)');
    console.log('=================================================================');
  } catch (err) {
    console.error('\n❌ REGRESSION TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRegressionSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
