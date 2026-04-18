import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (Next.js convention), then .env as fallback.
// In the container these are no-ops — DATABASE_URL / ADMIN_* are injected by compose.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { count } from 'drizzle-orm';
import { users } from '../lib/db/schema';

async function seedAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('seed-admin-boot: DATABASE_URL not set — refusing to run');
    process.exit(1);
  }

  if (!username || !passwordHash) {
    console.log('seed-admin-boot: ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set — skipping seed');
    return;
  }

  // Validate hash shape early so we fail loud, not silently insert garbage.
  if (!/^\$2[aby]\$\d{2}\$/.test(passwordHash)) {
    console.error('seed-admin-boot: ADMIN_PASSWORD_HASH does not look like a bcrypt hash — refusing to seed');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle({ client: pool });

  try {
    const [row] = await db.select({ value: count() }).from(users);
    const existing = Number(row?.value ?? 0);
    if (existing > 0) {
      console.log(`seed-admin-boot: users table not empty (count=${existing}) — skipping seed`);
      return;
    }

    await db.insert(users).values({
      username,
      passwordHash,
      role: 'admin',
    });
    console.log(`seed-admin-boot: admin user "${username}" created`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      console.log('seed-admin-boot: user already exists (unique constraint) — treating as seeded');
      return;
    }
    console.error('seed-admin-boot error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdmin().catch((err: unknown) => {
  console.error('seed-admin-boot fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
