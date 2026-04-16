import path from 'path';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_URL: z.string().url().optional(),
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  DEVDOCK_DATA_DIR: z.string().default('./data'),
  DEVDOCK_MAX_CONCURRENT_ENVS: z.coerce.number().int().min(1).default(3),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_CONFIG_PATH: z.string().optional().default(''),
  TERMINAL_PORT: z.coerce.number().int().min(1024).default(3001),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i,
    'Must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32').optional(),
  PRODUCTION_APPS_DIR: z.string().optional().default(''),
  PREVIEW_DOMAIN: z.string().optional().default(''),
  // Note: NEXT_PUBLIC_PREVIEW_DOMAIN must also be set for the client-side preview button.
  // It should match PREVIEW_DOMAIN (e.g., "preview.devdock.example.com").
  // Next.js public env vars are not validated here -- they are inlined at build time.
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  const data = parsed.data;
  // Resolve DEVDOCK_DATA_DIR to absolute path to avoid cwd-dependent resolution
  data.DEVDOCK_DATA_DIR = path.resolve(data.DEVDOCK_DATA_DIR);
  return data;
}

export const config = loadConfig();
