export interface TerminalToken {
  token: string;
  environmentId: string;
  userId: string;
  containerId: string;  // Docker container ID for the dev service
  expiresAt: number;    // Date.now() + 30_000
}

export interface ExecSession {
  execId: string;
  stream: NodeJS.ReadWriteStream;
  containerId: string;
  environmentId: string;
  userId: string;
}

export interface TerminalTokenRequest {
  environmentId: string;
}

// In-memory token store (acceptable for single-server, D-05 / A5)
// Tokens are short-lived (30s) so in-memory is fine.
const tokenStore = new Map<string, TerminalToken>();

export function storeToken(token: TerminalToken): void {
  tokenStore.set(token.token, token);
}

export function validateTerminalToken(tokenStr: string): TerminalToken | null {
  const token = tokenStore.get(tokenStr);
  if (!token) return null;
  if (Date.now() > token.expiresAt) {
    tokenStore.delete(tokenStr);
    return null;
  }
  // Single-use: delete after validation (prevents replay)
  tokenStore.delete(tokenStr);
  return token;
}

// Periodic cleanup of expired tokens (call from server startup)
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, token] of tokenStore) {
    if (now > token.expiresAt) {
      tokenStore.delete(key);
    }
  }
}
