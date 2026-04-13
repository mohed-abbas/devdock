import { createHmac, timingSafeEqual } from 'crypto';

export interface TokenPayload {
  environmentId: string;
  userId: string;
  containerId: string;
  exp: number; // Unix timestamp in ms
}

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) throw new Error('AUTH_SECRET environment variable is required');

function sign(payload: string): string {
  return createHmac('sha256', AUTH_SECRET!).update(payload).digest('hex');
}

/**
 * Create a signed terminal token.
 * Called by the Next.js API process (imported via relative path).
 */
export function createSignedToken(payload: TokenPayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Validate and decode a signed terminal token.
 * Called by the Socket.IO server process.
 * Returns null if invalid, expired, or tampered.
 */
export function verifySignedToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, providedSig] = parts;
  const expectedSig = sign(encoded);

  // Timing-safe comparison to prevent timing attacks
  try {
    const sigA = Buffer.from(providedSig, 'hex');
    const sigB = Buffer.from(expectedSig, 'hex');
    if (sigA.length !== sigB.length) return null;
    if (!timingSafeEqual(sigA, sigB)) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    // Check expiry
    if (Date.now() > data.exp) return null;
    return data as TokenPayload;
  } catch {
    return null;
  }
}
