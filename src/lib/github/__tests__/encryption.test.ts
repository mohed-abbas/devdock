import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../encryption';
import crypto from 'crypto';

const VALID_KEY = crypto.randomBytes(32).toString('hex'); // 64 hex chars

describe('encryption', () => {
  describe('roundtrip', () => {
    it('encrypt then decrypt returns original plaintext', () => {
      const plaintext = 'gho_abc123tokenvalue';
      const encrypted = encrypt(plaintext, VALID_KEY);
      const decrypted = decrypt(encrypted, VALID_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it('handles empty string', () => {
      const encrypted = encrypt('', VALID_KEY);
      const decrypted = decrypt(encrypted, VALID_KEY);
      expect(decrypted).toBe('');
    });

    it('handles unicode characters', () => {
      const plaintext = 'token-with-unicode-\u00e9\u00e8\u00ea';
      const encrypted = encrypt(plaintext, VALID_KEY);
      const decrypted = decrypt(encrypted, VALID_KEY);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('wrong key', () => {
    it('decrypt with wrong key throws an error', () => {
      const encrypted = encrypt('secret-token', VALID_KEY);
      const wrongKey = crypto.randomBytes(32).toString('hex');
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });

  describe('unique IV', () => {
    it('each encryption produces unique ciphertext due to random IV', () => {
      const plaintext = 'same-token';
      const encrypted1 = encrypt(plaintext, VALID_KEY);
      const encrypted2 = encrypt(plaintext, VALID_KEY);
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('invalid key length', () => {
    it('encrypt with short key throws', () => {
      expect(() => encrypt('data', 'abcd')).toThrow('32 bytes');
    });

    it('decrypt with short key throws', () => {
      const encrypted = encrypt('data', VALID_KEY);
      expect(() => decrypt(encrypted, 'abcd')).toThrow('32 bytes');
    });
  });

  describe('storage format', () => {
    it('encrypted output is iv_hex:tag_hex:ciphertext_hex format', () => {
      const encrypted = encrypt('test', VALID_KEY);
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // IV is 12 bytes = 24 hex chars
      expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
      // Ciphertext is hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });
  });
});
