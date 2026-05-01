import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';

describe('hash-password helper', () => {
  it('produces a bcrypt hash that verifies with bcrypt.compare', async () => {
    // RED stub: imports the helper that Plan 02 will create.
    // This test is expected to fail until src/scripts/hash-password.ts exists
    // AND exports a `hashPassword(plaintext: string): Promise<string>` function.
    const { hashPassword } = await import('../src/scripts/hash-password');
    const hash = await hashPassword('correcthorsebatterystaple');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    const valid = await bcrypt.compare('correcthorsebatterystaple', hash);
    expect(valid).toBe(true);
    const invalid = await bcrypt.compare('wrong-password', hash);
    expect(invalid).toBe(false);
  });
});
