/**
 * Organizer Management CLI for D Maain Voice Knowledge Project
 *
 * Secure tool for administrators to:
 * 1. List organizer accounts (no secret hashes displayed)
 * 2. Reset the password for an existing organizer account
 * 3. Create a new organizer account
 *
 * Usage:
 *   node scripts/manage-organizer.mjs list
 *   node scripts/manage-organizer.mjs reset-password [--email <email>]
 *   node scripts/manage-organizer.mjs create [--email <email>] [--name <name>] [--role <role>]
 *
 * Password can be provided interactively (hidden input) or via ORGANIZER_PASSWORD environment variable.
 */

import readline from 'readline';
import { prisma } from '../api/_lib/prisma.js';
import { hashPassword } from '../api/_lib/auth.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const flags = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  return { command, flags };
}

function promptText(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptPassword(query) {
  if (process.env.ORGANIZER_PASSWORD) {
    return Promise.resolve(process.env.ORGANIZER_PASSWORD.trim());
  }

  return new Promise((resolve) => {
    process.stdout.write(query);

    if (process.stdin.isTTY) {
      let password = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdout.write('\nOperation cancelled.\n');
          process.exit(1);
        } else if (char === '\u0008' || char === '\x7f') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          password += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

async function listOrganizers() {
  console.log('\n--- D Maain Voice Organizer Directory ---');
  const organizers = await prisma.organizer.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (organizers.length === 0) {
    console.log('No organizer accounts found in the database.');
    return;
  }

  for (const org of organizers) {
    console.log(`\n• ID:         ${org.id}`);
    console.log(`  Name:       ${org.name}`);
    console.log(`  Email:      ${org.email}`);
    console.log(`  Role:       ${org.role}`);
    console.log(`  Created:    ${org.createdAt.toISOString()}`);
    console.log(`  Updated:    ${org.updatedAt.toISOString()}`);
  }
  console.log(`\nTotal: ${organizers.length} organizer(s).\n`);
}

async function resetPassword(flags) {
  let email = flags.email;
  if (!email) {
    email = await promptText('Enter organizer email: ');
  }

  if (!email) {
    console.error('Error: Email address is required.');
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();

  const organizer = await prisma.organizer.findUnique({
    where: { email: cleanEmail },
  });

  if (!organizer) {
    console.error(`Error: No organizer account found with email "${cleanEmail}".`);
    process.exit(1);
  }

  let password = flags.password;
  if (!password) {
    password = await promptPassword(`Enter new password for ${cleanEmail} (min 8 chars): `);
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log('\nHashing password securely with bcrypt (12 rounds)...');
  const passwordHash = await hashPassword(password);

  await prisma.organizer.update({
    where: { email: cleanEmail },
    data: { passwordHash },
  });

  console.log(`Success: Password for ${cleanEmail} has been updated.`);
  console.log(`You can now log in at /admin.html using this email and new password.\n`);
}

async function createOrganizer(flags) {
  let email = flags.email;
  if (!email) {
    email = await promptText('Enter organizer email: ');
  }
  if (!email) {
    console.error('Error: Email address is required.');
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();

  const existing = await prisma.organizer.findUnique({
    where: { email: cleanEmail },
  });

  if (existing) {
    console.error(`Error: An organizer with email "${cleanEmail}" already exists (ID: ${existing.id}).`);
    console.error('To update the password, run: node scripts/manage-organizer.mjs reset-password --email ' + cleanEmail);
    process.exit(1);
  }

  let name = flags.name;
  if (!name) {
    name = await promptText('Enter organizer full name: ');
  }
  if (!name) {
    console.error('Error: Name is required.');
    process.exit(1);
  }

  let role = flags.role || 'organizer';

  let password = flags.password;
  if (!password) {
    password = await promptPassword(`Enter password for ${cleanEmail} (min 8 chars): `);
  }

  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  console.log('\nHashing password securely with bcrypt (12 rounds)...');
  const passwordHash = await hashPassword(password);

  const created = await prisma.organizer.create({
    data: {
      email: cleanEmail,
      name: name.trim(),
      role: role.trim().toLowerCase(),
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  console.log(`\nSuccess: Created organizer "${created.name}" (${created.email}) with role "${created.role}".`);
  console.log(`Account ID: ${created.id}`);
  console.log(`You can now log in at /admin.html.\n`);
}

function showHelp() {
  console.log(`
D Maain Voice Organizer Management CLI

Usage:
  node scripts/manage-organizer.mjs <command> [options]

Commands:
  list                          List all registered organizer accounts (without secrets)
  reset-password                Reset the password for an existing organizer
  create                        Create a new organizer account

Options:
  --email <email>               Organizer email address
  --name <name>                 Organizer full name (for create command)
  --role <role>                 Organizer role (default: "organizer", or "admin")
  --password <password>         Provide password directly via CLI argument

Environment Variables:
  ORGANIZER_PASSWORD            Provide password via environment variable (avoids CLI history)
`);
}

async function main() {
  const { command, flags } = parseArgs();

  try {
    switch (command) {
      case 'list':
        await listOrganizers();
        break;
      case 'reset-password':
      case 'reset':
        await resetPassword(flags);
        break;
      case 'create':
      case 'add':
        await createOrganizer(flags);
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
