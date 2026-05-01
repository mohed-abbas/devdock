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
 * Register a preview route for an environment that just started.
 * No-ops silently if:
 *   - PREVIEW_DOMAIN is unconfigured
 *   - env has no previewPort set
 * Logs but swallows errors from Caddy — environment start should not fail on a
 * proxy-registration hiccup (graceful degradation; next restart re-registers).
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
