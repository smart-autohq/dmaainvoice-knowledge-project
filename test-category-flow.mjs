import { prisma } from './api/_lib/prisma.js';
import { signToken } from './api/_lib/auth.js';

const BASE_URL = 'http://localhost:3000';

async function runCategoryTests() {
  console.log('--- Starting Comprehensive Session Category Flow Tests ---');

  // 1. Get organizer and generate auth token
  const organizer = await prisma.organizer.findFirst();
  if (!organizer) {
    throw new Error('No organizer found in DB to perform test.');
  }
  const token = signToken({ id: organizer.id, email: organizer.email, role: organizer.role });
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const categoriesToTest = [
    { name: 'Technology', slug: 'technology', expectedLabel: 'Technology' },
    { name: 'Islamic Finance', slug: 'finance', expectedLabel: 'Islamic Finance' },
    { name: 'Business', slug: 'business', expectedLabel: 'Business' },
    { name: 'Personal Development', slug: 'personal-development', expectedLabel: 'Personal Development' },
  ];

  const createdSessionIds = [];

  try {
    // 2. Test creation for each category
    for (const cat of categoriesToTest) {
      console.log(`\n[Testing Category: ${cat.name} (${cat.slug})]`);
      
      const sessionPayload = {
        title: `Test Category Session ${cat.name} ${Date.now()}`,
        description: `Detailed description for testing category ${cat.name}`,
        category: cat.slug,
        sessionDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        venue: 'Google Meet (Virtual)',
        status: 'UPCOMING',
      };

      // A. Create Session via POST /api/admin/sessions
      const createRes = await fetch(`${BASE_URL}/api/admin/sessions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(sessionPayload),
      });

      const createData = await createRes.json();
      if (!createRes.ok || !createData.success) {
        throw new Error(`Failed to create session for ${cat.name}: ${JSON.stringify(createData)}`);
      }
      
      const createdSession = createData.data;
      createdSessionIds.push(createdSession.id);
      console.log(`  ✓ 1. Dashboard payload sent category: "${cat.slug}"`);
      console.log(`  ✓ POST Response returned category: "${createdSession.category}", label: "${createdSession.categoryLabel}"`);

      if (createdSession.category !== cat.slug) {
        throw new Error(`Expected POST returned category to be "${cat.slug}", got "${createdSession.category}"`);
      }
      if (createdSession.categoryLabel !== cat.expectedLabel) {
        throw new Error(`Expected POST returned categoryLabel to be "${cat.expectedLabel}", got "${createdSession.categoryLabel}"`);
      }

      // B. Verify Database persistence directly
      const dbSession = await prisma.session.findUnique({ where: { id: createdSession.id } });
      console.log(`  ✓ 2. Database stores category: "${dbSession.category}"`);
      if (dbSession.category !== cat.slug) {
        throw new Error(`Database check failed: expected "${cat.slug}", found "${dbSession.category}"`);
      }

      // C. Verify GET /api/admin/sessions
      const adminGetRes = await fetch(`${BASE_URL}/api/admin/sessions`, {
        headers: authHeaders,
      });
      const adminGetData = await adminGetRes.json();
      const adminFound = (adminGetData.data || []).find(s => s.id === createdSession.id);
      if (!adminFound) throw new Error('Session not found in admin sessions list');
      console.log(`  ✓ 3. Admin API returns category: "${adminFound.category}", label: "${adminFound.categoryLabel}"`);
      if (adminFound.category !== cat.slug) {
        throw new Error(`Admin GET expected "${cat.slug}", got "${adminFound.category}"`);
      }

      // D. Verify Public API: GET /api/sessions
      const publicGetRes = await fetch(`${BASE_URL}/api/sessions`);
      const publicGetData = await publicGetRes.json();
      const publicFound = (publicGetData.data || []).find(s => s.id === createdSession.id);
      if (!publicFound) throw new Error('Session not found in public sessions list');
      console.log(`  ✓ 4. Public API returns category: "${publicFound.category}", label: "${publicFound.categoryLabel}"`);
      if (publicFound.category !== cat.slug) {
        throw new Error(`Public GET expected "${cat.slug}", got "${publicFound.category}"`);
      }
      if (publicFound.categoryLabel !== cat.expectedLabel) {
        throw new Error(`Public card badge label expected "${cat.expectedLabel}", got "${publicFound.categoryLabel}"`);
      }

      // E. Verify Category Filtering: GET /api/sessions?category=<cat.slug>
      const filterRes = await fetch(`${BASE_URL}/api/sessions?category=${cat.slug}`);
      const filterData = await filterRes.json();
      const inFilter = (filterData.data || []).some(s => s.id === createdSession.id);
      console.log(`  ✓ 5. Category filter for "${cat.slug}" returned the session: ${inFilter}`);
      if (!inFilter) {
        throw new Error(`Category filter for "${cat.slug}" failed to return session ${createdSession.id}`);
      }

      // Negative check: Querying a different category should not return this session
      const otherCategory = cat.slug === 'technology' ? 'business' : 'technology';
      const otherFilterRes = await fetch(`${BASE_URL}/api/sessions?category=${otherCategory}`);
      const otherFilterData = await otherFilterRes.json();
      const inOtherFilter = (otherFilterData.data || []).some(s => s.id === createdSession.id);
      console.log(`  ✓ Category filter isolation verified (not present under "${otherCategory}"): ${!inOtherFilter}`);
      if (inOtherFilter) {
        throw new Error(`Session with category "${cat.slug}" incorrectly matched filter "${otherCategory}"`);
      }
    }

    // 3. Test Session Editing & Category Updating
    console.log('\n[Testing Session Editing and Category Switching]');
    const editSessionId = createdSessionIds[0];
    
    // Update to 'business'
    const updateRes = await fetch(`${BASE_URL}/api/admin/sessions/${editSessionId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Updated Title for Category Switch Test',
        category: 'business',
      }),
    });
    const updateData = await updateRes.json();
    if (!updateRes.ok || !updateData.success) {
      throw new Error(`Failed to update session: ${JSON.stringify(updateData)}`);
    }
    console.log(`  ✓ 6. Session updated category to "business". API returned: "${updateData.data.category}" (${updateData.data.categoryLabel})`);
    if (updateData.data.category !== 'business' || updateData.data.categoryLabel !== 'Business') {
      throw new Error('Update response did not reflect updated category');
    }

    // Verify DB after update
    const dbAfterUpdate = await prisma.session.findUnique({ where: { id: editSessionId } });
    console.log(`  ✓ DB after edit stores category: "${dbAfterUpdate.category}"`);
    if (dbAfterUpdate.category !== 'business') {
      throw new Error('Database does not have updated category "business"');
    }

    // 4. Test Editing other fields while preserving existing category
    const partialUpdateRes = await fetch(`${BASE_URL}/api/admin/sessions/${editSessionId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        venue: 'Main Auditorium & Google Meet',
      }),
    });
    const partialData = await partialUpdateRes.json();
    console.log(`  ✓ Existing session retained category "${partialData.data.category}" when editing other fields without sending category.`);
    if (partialData.data.category !== 'business') {
      throw new Error('Category was unintentionally overwritten during partial update');
    }

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    // Clean up only our test sessions
    console.log(`\nCleaning up ${createdSessionIds.length} test sessions...`);
    for (const id of createdSessionIds) {
      try {
        await prisma.session.delete({ where: { id } });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    console.log('Test sessions cleaned up.');
    await prisma.$disconnect();
  }
}

runCategoryTests().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
