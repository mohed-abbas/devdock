import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { isValidEnvironmentStatus } from '../types';
import type { EnvironmentStatus, ComposeOptions, DockerServiceResult, ContainerInfo, EnvironmentStatusResult } from '../types';

describe('EnvironmentStatus type', () => {
  it('matches the pgEnum values from schema', () => {
    const validStatuses: string[] = ['stopped', 'starting', 'running', 'stopping', 'error'];

    // Verify the runtime validator accepts all valid statuses
    for (const status of validStatuses) {
      expect(isValidEnvironmentStatus(status)).toBe(true);
    }

    // Verify invalid statuses are rejected
    expect(isValidEnvironmentStatus('invalid')).toBe(false);
    expect(isValidEnvironmentStatus('')).toBe(false);
    expect(isValidEnvironmentStatus('RUNNING')).toBe(false);
  });

  it('exports all expected interfaces', async () => {
    const types = await import('../types');
    expect(types).toHaveProperty('isValidEnvironmentStatus');
    expect(typeof types.isValidEnvironmentStatus).toBe('function');
  });
});

describe('Config DEVDOCK_DATA_DIR resolution', () => {
  it('resolves relative DEVDOCK_DATA_DIR to absolute path', async () => {
    // The config module should resolve './data' to an absolute path
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/test');
    vi.stubEnv('AUTH_SECRET', 'a'.repeat(32));
    vi.stubEnv('DEVDOCK_DATA_DIR', './data');

    // Clear module cache to reload config with new env
    vi.resetModules();

    const { config } = await import('../../config');

    expect(path.isAbsolute(config.DEVDOCK_DATA_DIR)).toBe(true);
    expect(config.DEVDOCK_DATA_DIR).toBe(path.resolve('./data'));

    vi.unstubAllEnvs();
  });
});
