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
