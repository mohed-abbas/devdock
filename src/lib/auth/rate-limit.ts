// In-memory rate limiter for login attempts
// Resets on server restart (acceptable per D-13)

const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30 * 1000; // 30 seconds

export function checkRateLimit(username: string): { allowed: boolean; retryAfter?: number } {
  const record = failedAttempts.get(username);
  if (!record) return { allowed: true };

  const elapsed = Date.now() - record.lastAttempt;
  if (record.count >= MAX_ATTEMPTS && elapsed < COOLDOWN_MS) {
    return { allowed: false, retryAfter: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
  }

  // Cooldown expired -- reset
  if (elapsed >= COOLDOWN_MS) {
    failedAttempts.delete(username);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(username: string): void {
  const record = failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(username, record);
}

export function clearFailedAttempts(username: string): void {
  failedAttempts.delete(username);
}
