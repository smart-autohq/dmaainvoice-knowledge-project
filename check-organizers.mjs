import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const orgs = await prisma.organizer.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  console.log(`\n=== Organizer Accounts Found: ${orgs.length} ===`);
  if (orgs.length === 0) {
    console.log('No organizer accounts exist in the database.');
  } else {
    for (const o of orgs) {
      console.log(`  ID:      ${o.id}`);
      console.log(`  Name:    ${o.name}`);
      console.log(`  Email:   ${o.email}`);
      console.log(`  Role:    ${o.role}`);
      console.log(`  Created: ${o.createdAt.toISOString()}`);
      console.log('  ---');
    }
  }
} catch (err) {
  console.error('Error querying organizers:', err.message);
} finally {
  await prisma.$disconnect();
}
