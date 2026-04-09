import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local first (Next.js convention), fall back to .env
config({ path: '.env.local' });
config({ path: '.env' });

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
