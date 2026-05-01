import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt at the canonical DevDock rounds (12).
 * Exported so tests can verify the algorithm without invoking the CLI.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('hashPassword: plaintext must be a non-empty string');
  }
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function main(): Promise<void> {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npm run hash-password -- <password>');
    process.exit(1);
  }
  const hash = await hashPassword(password);
  // eslint-disable-next-line no-console
  console.log(hash);
}

// Only auto-run when invoked as a script, not when imported (e.g. by tests).
// tsx compiles to CommonJS-ish semantics so `require.main === module` works.
const isMain =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
