// Token management has moved to server/terminal-auth.ts using HMAC-signed tokens
// for cross-process compatibility between Next.js (port 3000) and terminal server (port 3001).

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
