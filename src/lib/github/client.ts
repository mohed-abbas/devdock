import { Octokit } from '@octokit/rest';
import { decrypt } from './encryption';

export function createOctokit(encryptedToken: string, encryptionKey: string): Octokit {
  const token = decrypt(encryptedToken, encryptionKey);
  return new Octokit({ auth: token });
}
