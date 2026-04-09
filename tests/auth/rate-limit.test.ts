import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from '../../src/lib/auth/rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    // Clear any state between tests
    clearFailedAttempts('testuser');
    clearFailedAttempts('otheruser');
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns allowed: true for unknown username', () => {
    const result = checkRateLimit('unknown-user-' + Date.now());
    expect(result).toEqual({ allowed: true });
  });

  it('returns allowed: false after 5 failed attempts', () => {
    const username = 'testuser';
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(username);
    }
    const result = checkRateLimit(username);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('returns allowed: true after cooldown period elapses', () => {
    vi.useFakeTimers();
    const username = 'testuser';

    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(username);
    }
    expect(checkRateLimit(username).allowed).toBe(false);

    // Advance time past the 30-second cooldown
    vi.advanceTimersByTime(31 * 1000);

    const result = checkRateLimit(username);
    expect(result.allowed).toBe(true);
  });

  it('clearFailedAttempts resets the counter', () => {
    const username = 'testuser';
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(username);
    }
    expect(checkRateLimit(username).allowed).toBe(false);

    clearFailedAttempts(username);

    const result = checkRateLimit(username);
    expect(result).toEqual({ allowed: true });
  });
});
