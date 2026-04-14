import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildAuthorizeUrl, generateState, exchangeCodeForToken } from '../oauth';

describe('oauth', () => {
  describe('buildAuthorizeUrl', () => {
    it('returns authorize URL with correct client_id, redirect_uri, scope=repo, state params', () => {
      const url = buildAuthorizeUrl('my-client-id', 'http://localhost:3000/api/github/callback', 'abc123state');
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe('my-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/github/callback');
      expect(parsed.searchParams.get('scope')).toBe('repo');
      expect(parsed.searchParams.get('state')).toBe('abc123state');
    });
  });

  describe('generateState', () => {
    it('returns 64-char hex string', () => {
      const state = generateState();
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique values', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('exchangeCodeForToken', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('calls GitHub token URL with correct params and returns token data', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ access_token: 'gho_abc123', scope: 'repo', token_type: 'bearer' }),
      };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await exchangeCodeForToken('code123', 'client-id', 'client-secret');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            client_id: 'client-id',
            client_secret: 'client-secret',
            code: 'code123',
          }),
        }),
      );
      expect(result.access_token).toBe('gho_abc123');
      expect(result.scope).toBe('repo');
    });

    it('throws when response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(exchangeCodeForToken('code', 'id', 'secret')).rejects.toThrow('Token exchange failed');
    });

    it('throws when GitHub returns error in body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: 'bad_verification_code', error_description: 'The code is invalid' }),
      });
      await expect(exchangeCodeForToken('code', 'id', 'secret')).rejects.toThrow('The code is invalid');
    });
  });
});
