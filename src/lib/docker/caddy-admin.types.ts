/**
 * Types for the Caddy Admin API client (Phase 999.2, D-11).
 * Route JSON shape matches RESEARCH.md §6 reference implementation.
 */

export interface CaddyRoute {
  '@id': string;
  match: Array<{ host: string[] }>;
  handle: Array<{
    handler: 'reverse_proxy';
    upstreams: Array<{ dial: string }>;
  }>;
  terminal: true;
}

export interface AddPreviewRouteInput {
  /** Environment slug — used to build the route @id tag. Must be URL-safe. */
  envSlug: string;
  /** Environment UUID — used as the preview subdomain prefix. */
  envId: string;
  /** Preview host suffix (e.g., "preview.devdock.example.com"). */
  previewDomain: string;
  /** Target container name reachable on devdock-proxy (e.g., "devdock-my-app-dev"). */
  containerName: string;
  /** Port the dev app listens on inside the container (1..65535). */
  previewPort: number;
}

export interface CaddyAdminError extends Error {
  status?: number;
}
