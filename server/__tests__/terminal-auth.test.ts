import { describe, it, expect, beforeAll } from 'vitest';

// Set AUTH_SECRET before importing the module (it checks on load)
process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-chars-long';

import { createSignedToken, verifySignedToken, type TokenPayload } from '../terminal-auth';

describe('terminal-auth', () => {
  const makePayload = (overrides: Partial<TokenPayload> = {}): TokenPayload => ({
    environmentId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    containerId: 'abc123def456',
    exp: Date.now() + 30_000,
    ...overrides,
  });

  it('createSignedToken returns a string with two dot-separated parts', () => {
    const token = createSignedToken(makePayload());
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('verifySignedToken with valid token returns the payload', () => {
    const payload = makePayload();
    const token = createSignedToken(payload);

    const result = verifySignedToken(token);
    expect(result).not.toBeNull();
    expect(result!.environmentId).toBe(payload.environmentId);
    expect(result!.userId).toBe(payload.userId);
    expect(result!.containerId).toBe(payload.containerId);
    expect(result!.exp).toBe(payload.exp);
  });

  it('verifySignedToken with expired token returns null', () => {
    const payload = makePayload({ exp: Date.now() - 1000 });
    const token = createSignedToken(payload);

    const result = verifySignedToken(token);
    expect(result).toBeNull();
  });

  it('verifySignedToken with tampered signature returns null', () => {
    const token = createSignedToken(makePayload());
    const parts = token.split('.');
    // Tamper with the signature by flipping a character
    const tampered = parts[0] + '.' + 'a'.repeat(parts[1].length);

    const result = verifySignedToken(tampered);
    expect(result).toBeNull();
  });

  it('verifySignedToken with garbage string returns null', () => {
    const result = verifySignedToken('not-a-valid-token-at-all');
    expect(result).toBeNull();
  });

  it('verifySignedToken with empty string returns null', () => {
    const result = verifySignedToken('');
    expect(result).toBeNull();
  });
});
