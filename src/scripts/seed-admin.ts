import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (Next.js convention), then .env as fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from '../lib/db/schema';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8; // D-09

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    console.error('Make sure .env.local exists with DATABASE_URL=postgresql://...');
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n--- DevDock User Setup ---\n');

    const username = await rl.question('Username: ');
    if (!username || username.trim().length === 0) {
      console.error('Error: Username cannot be empty.');
      process.exit(1);
    }

    const password = await rl.question('Password (min 8 characters): ');
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`Error: Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      process.exit(1);
    }

    const roleInput = await rl.question('Role (admin/user) [admin]: ');
    const role = (roleInput.trim().toLowerCase() === 'user') ? 'user' as const : 'admin' as const;

    console.log(`\nCreating ${role} user "${username.trim()}"...`);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle({ client: pool });

    await db.insert(users).values({
      username: username.trim(),
      passwordHash,
      role,
    });

    console.log(`\nSuccess: ${role} user "${username.trim()}" created.`);
    await pool.end();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      console.error('Error: That username already exists.');
    } else {
      console.error('Error:', error instanceof Error ? error.message : error);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
