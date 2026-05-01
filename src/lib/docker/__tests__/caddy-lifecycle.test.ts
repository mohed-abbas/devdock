import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// W-02 contract test for caddy-lifecycle.registerPreviewRoute:
//   - happy path: forwards to addPreviewRoute, returns void
//   - PREVIEW_DOMAIN unset: no-op (no admin call)
//   - previewPort null: no-op (no admin call)
//   - addPreviewRoute throws: re-throws as PreviewRegistrationError carrying the slug
//
// This is the contract route handlers (start/POST/PATCH) rely on to surface
// preview failures via env.errorMessage instead of swallowing them silently.

process.env.AUTH_SECRET = 'x'.repeat(32);
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';

const addPreviewRouteMock = vi.fn();
const removePreviewRouteMock = vi.fn();

vi.mock('../caddy-admin', () => ({
  addPreviewRoute: (...args: unknown[]) => addPreviewRouteMock(...args),
  removePreviewRoute: (...args: unknown[]) => removePreviewRouteMock(...args),
}));

async function loadModule(previewDomain: string) {
  vi.resetModules();
  process.env.PREVIEW_DOMAIN = previewDomain;
  return await import('../caddy-lifecycle');
}

beforeEach(() => {
  addPreviewRouteMock.mockReset();
  removePreviewRouteMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registerPreviewRoute', () => {
  it('happy path: calls addPreviewRoute with derived container name + domain', async () => {
    addPreviewRouteMock.mockResolvedValueOnce(undefined);
    const { registerPreviewRoute } = await loadModule('preview.devdock.example.com:8080');

    await registerPreviewRoute({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      slug: 'my-app',
      previewPort: 3000,
    });

    expect(addPreviewRouteMock).toHaveBeenCalledOnce();
    expect(addPreviewRouteMock).toHaveBeenCalledWith({
      envSlug: 'my-app',
      envId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      // port stripped from the configured PREVIEW_DOMAIN
      previewDomain: 'preview.devdock.example.com',
      containerName: 'devdock-my-app-dev',
      previewPort: 3000,
    });
  });

  it('no-ops silently when PREVIEW_DOMAIN is unset', async () => {
    const { registerPreviewRoute } = await loadModule('');
    await registerPreviewRoute({ id: 'a', slug: 'x', previewPort: 3000 });
    expect(addPreviewRouteMock).not.toHaveBeenCalled();
  });

  it('no-ops silently when previewPort is null', async () => {
    const { registerPreviewRoute } = await loadModule('preview.example.com');
    await registerPreviewRoute({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      slug: 'no-port',
      previewPort: null,
    });
    expect(addPreviewRouteMock).not.toHaveBeenCalled();
  });

  it('wraps caddy-admin errors in PreviewRegistrationError carrying the slug', async () => {
    addPreviewRouteMock.mockRejectedValueOnce(new Error('caddy admin PUT route failed: 502 bad gateway'));
    const { registerPreviewRoute, PreviewRegistrationError } = await loadModule('preview.example.com');

    let caught: unknown;
    try {
      await registerPreviewRoute({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        slug: 'broken',
        previewPort: 3000,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(PreviewRegistrationError);
    const err = caught as InstanceType<typeof PreviewRegistrationError>;
    expect(err.slug).toBe('broken');
    expect(err.message).toContain('broken');
    expect(err.message).toContain('502 bad gateway');
    expect(err.name).toBe('PreviewRegistrationError');
  });

  it('passes through non-Error throws as PreviewRegistrationError', async () => {
    addPreviewRouteMock.mockRejectedValueOnce('plain string failure');
    const { registerPreviewRoute, PreviewRegistrationError } = await loadModule('preview.example.com');

    await expect(
      registerPreviewRoute({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        slug: 'weird',
        previewPort: 3000,
      }),
    ).rejects.toBeInstanceOf(PreviewRegistrationError);
  });
});

describe('deregisterPreviewRoute', () => {
  it('forwards to removePreviewRoute on the happy path', async () => {
    removePreviewRouteMock.mockResolvedValueOnce(undefined);
    const { deregisterPreviewRoute } = await loadModule('preview.example.com');
    await deregisterPreviewRoute('my-app');
    expect(removePreviewRouteMock).toHaveBeenCalledWith('my-app');
  });

  it('swallows caddy errors (best-effort cleanup) — the stop/delete path must not fail on Caddy hiccup', async () => {
    removePreviewRouteMock.mockRejectedValueOnce(new Error('500 internal'));
    const { deregisterPreviewRoute } = await loadModule('preview.example.com');
    await expect(deregisterPreviewRoute('my-app')).resolves.toBeUndefined();
  });

  it('no-ops when PREVIEW_DOMAIN is unset', async () => {
    const { deregisterPreviewRoute } = await loadModule('');
    await deregisterPreviewRoute('my-app');
    expect(removePreviewRouteMock).not.toHaveBeenCalled();
  });
});
