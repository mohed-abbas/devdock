/**
 * Higher-level helpers that bridge environment records to Caddy Admin API calls.
 * Isolated here so the HTTP client (caddy-admin.ts) stays pure.
 */
import { config } from '@/lib/config';
import { addPreviewRoute, removePreviewRoute } from './caddy-admin';

interface EnvRecord {
  id: string;
  slug: string;
  previewPort: number | null;
}

/**
 * Thrown when Caddy preview-route registration fails. Callers should catch
 * this and persist a user-visible warning (e.g. environments.errorMessage)
 * — the env itself may still be running, but its preview URL won't work
 * until Caddy gets the route. Distinguishing this from generic Errors lets
 * callers keep status='running' rather than flipping to 'error'.
 */
export class PreviewRegistrationError extends Error {
  constructor(public readonly slug: string, cause: unknown) {
    super(
      `Preview routing unavailable for ${slug}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = 'PreviewRegistrationError';
  }
}

/**
 * Register a preview route for an environment that just started.
 * Returns silently (with no Caddy call) if:
 *   - PREVIEW_DOMAIN is unconfigured
 *   - env has no previewPort set
 * Throws PreviewRegistrationError on Caddy failure so the caller can surface
 * the failure to the user (the env may still be running fine — only preview
 * routing is broken). Caller decides whether to flip status to 'error' or
 * persist a warning while keeping status='running'.
 */
export async function registerPreviewRoute(env: EnvRecord): Promise<void> {
  if (!config.PREVIEW_DOMAIN) return;
  if (!env.previewPort) return;

  const containerName = `devdock-${env.slug}-dev`;
  try {
    await addPreviewRoute({
      envSlug: env.slug,
      envId: env.id,
      previewDomain: config.PREVIEW_DOMAIN.split(':')[0], // strip port from domain
      containerName,
      previewPort: env.previewPort,
    });
    console.log(`[caddy-lifecycle] registered preview for ${env.slug}`);
  } catch (err) {
    console.error(
      `[caddy-lifecycle] failed to register preview for ${env.slug}:`,
      err instanceof Error ? err.message : err,
    );
    throw new PreviewRegistrationError(env.slug, err);
  }
}

/**
 * Remove a preview route when an environment stops or is deleted. Idempotent:
 * safe to call even if no route was ever registered.
 */
export async function deregisterPreviewRoute(envSlug: string): Promise<void> {
  if (!config.PREVIEW_DOMAIN) return;
  try {
    await removePreviewRoute(envSlug);
    console.log(`[caddy-lifecycle] deregistered preview for ${envSlug}`);
  } catch (err) {
    console.error(
      `[caddy-lifecycle] failed to deregister preview for ${envSlug}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
