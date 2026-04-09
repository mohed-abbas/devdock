import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  DEVDOCK_DATA_DIR: z.string().default('./data'),
  DEVDOCK_MAX_CONCURRENT_ENVS: z.coerce.number().int().min(1).default(3),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const config = loadConfig();
