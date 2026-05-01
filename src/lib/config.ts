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

  // --- Containerization (Phase 999.2) ---
  // Postgres service password (used by compose `postgres` service + DATABASE_URL).
  POSTGRES_PASSWORD: z.string().min(8, 'POSTGRES_PASSWORD must be at least 8 characters').optional(),
  // Admin seed (D-14). Both must be set for first-boot seeding to run.
  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d{2}\$/, 'ADMIN_PASSWORD_HASH must be a bcrypt hash').optional(),
  // Caddy Admin API (D-11). Default matches the compose service name `caddy` on devdock-net.
  CADDY_ADMIN_URL: z.string().url().default('http://caddy:2019'),
  // Public Caddy listen port inside the compose network (host nginx proxies here via 127.0.0.1).
  CADDY_INTERNAL_PORT: z.coerce.number().int().min(1024).max(65535).default(8080),
  // Docker socket GID — optional; entrypoint detects at runtime if unset (RESEARCH.md Open Questions #2).
  DOCKER_GID: z.coerce.number().int().min(0).optional(),
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
