import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  storeToken,
  validateTerminalToken,
  cleanupExpiredTokens,
} from '@/lib/terminal/types';
import type { TerminalToken } from '@/lib/terminal/types';

describe('Terminal Token Store', () => {
  const makeToken = (overrides: Partial<TerminalToken> = {}): TerminalToken => ({
    token: 'test-token-abcdefgh12345678abcd',
    environmentId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    containerId: 'abc123def456',
    expiresAt: Date.now() + 30_000,
    ...overrides,
  });

  beforeEach(() => {
    // Clean state between tests by validating any leftover tokens
    // (validateTerminalToken deletes on read)
  });

  it('stores a token and validates it within TTL', () => {
    const token = makeToken();
    storeToken(token);

    const result = validateTerminalToken(token.token);
    expect(result).not.toBeNull();
    expect(result!.token).toBe(token.token);
    expect(result!.environmentId).toBe(token.environmentId);
    expect(result!.userId).toBe(token.userId);
    expect(result!.containerId).toBe(token.containerId);
  });

  it('returns null for expired tokens', () => {
    const token = makeToken({ expiresAt: Date.now() - 1000 });
    storeToken(token);

    const result = validateTerminalToken(token.token);
    expect(result).toBeNull();
  });

  it('tokens are single-use (second validation returns null)', () => {
    const token = makeToken({ token: 'single-use-token-1234567890ab' });
    storeToken(token);

    const first = validateTerminalToken(token.token);
    expect(first).not.toBeNull();

    const second = validateTerminalToken(token.token);
    expect(second).toBeNull();
  });

  it('returns null for non-existent tokens', () => {
    const result = validateTerminalToken('does-not-exist-at-all-nope');
    expect(result).toBeNull();
  });

  it('cleanupExpiredTokens removes expired tokens', () => {
    const expired = makeToken({
      token: 'expired-token-cleanup-test1234',
      expiresAt: Date.now() - 5000,
    });
    const valid = makeToken({
      token: 'valid-token-cleanup-test12345',
      expiresAt: Date.now() + 30_000,
    });
    storeToken(expired);
    storeToken(valid);

    cleanupExpiredTokens();

    // Expired should be gone
    expect(validateTerminalToken(expired.token)).toBeNull();
    // Valid should still be present
    expect(validateTerminalToken(valid.token)).not.toBeNull();
  });

  it('token has 30-second TTL by convention', () => {
    const now = Date.now();
    const token = makeToken({ expiresAt: now + 30_000 });
    storeToken(token);

    const result = validateTerminalToken(token.token);
    expect(result).not.toBeNull();
    expect(result!.expiresAt).toBe(now + 30_000);
  });
});
