import { describe, it, expect } from 'vitest';

// Token management moved to server/terminal-auth.ts (HMAC-signed tokens).
// The in-memory storeToken/validateTerminalToken functions were removed from types.ts.
// See server/__tests__/terminal-auth.test.ts for token signing/verification tests.

// Set AUTH_SECRET before importing (terminal-auth checks on load)
process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-chars-long';

import { createSignedToken, verifySignedToken } from '../../../../../server/terminal-auth';

describe('Terminal Token API - Signed Token Integration', () => {
  it('creates a signed token with correct format (base64url.hex)', () => {
    const token = createSignedToken({
      environmentId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      containerId: 'abc123def456',
      exp: Date.now() + 30_000,
    });

    expect(typeof token).toBe('string');
    const parts = token.split('.');
    expect(parts).toHaveLength(2);

    // First part is base64url-encoded JSON
    const decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    expect(decoded.environmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(decoded.userId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(decoded.containerId).toBe('abc123def456');

    // Second part is hex signature
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
  });

  it('signed token is verifiable and contains payload fields', () => {
    const token = createSignedToken({
      environmentId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      containerId: 'abc123def456',
      exp: Date.now() + 30_000,
    });

    const payload = verifySignedToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.environmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(payload!.userId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(payload!.containerId).toBe('abc123def456');
  });

  it('expired signed token is rejected', () => {
    const token = createSignedToken({
      environmentId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      containerId: 'abc123def456',
      exp: Date.now() - 1000,
    });

    const payload = verifySignedToken(token);
    expect(payload).toBeNull();
  });
});
