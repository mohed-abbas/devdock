import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch BEFORE importing the module under test so the module-level
// CADDY_ADMIN_URL read from config doesn't race with mocks.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Ensure CADDY_ADMIN_URL is a known value for tests.
process.env.CADDY_ADMIN_URL = 'http://caddy.test:2019';
process.env.AUTH_SECRET = 'x'.repeat(32);
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';

async function loadModule() {
  // Fresh import per test to reset the serverKey cache.
  vi.resetModules();
  return await import('../caddy-admin');
}

function okResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function notFoundResponse(): Response {
  return new Response('not found', { status: 404 });
}

function errorResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

const validInput = {
  envSlug: 'my-app',
  envId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  previewDomain: 'preview.devdock.example.com',
  containerName: 'devdock-my-app-dev',
  previewPort: 3000,
};

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getServerKey', () => {
  it('returns first server key from GET /config/apps/http/servers/', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ srv0: {}, custom: {} }));
    const { getServerKey } = await loadModule();
    const key = await getServerKey();
    expect(key).toBe('srv0');
    expect(fetchMock).toHaveBeenCalledWith('http://caddy.test:2019/config/apps/http/servers/', expect.any(Object));
  });

  it('caches the result across calls', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ srv0: {} }));
    const { getServerKey } = await loadModule();
    await getServerKey();
    await getServerKey();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws with truncated error when admin API errors', async () => {
    const longBody = 'x'.repeat(1000);
    fetchMock.mockResolvedValueOnce(errorResponse(500, longBody));
    const { getServerKey } = await loadModule();
    await expect(getServerKey()).rejects.toThrow(/caddy admin/i);
    try {
      await getServerKey();
    } catch (err) {
      expect((err as Error).message.length).toBeLessThanOrEqual(600);
    }
  });
});

describe('addPreviewRoute', () => {
  it('performs DELETE then PUT-at-index-0 (idempotent head-insert)', async () => {
    // 1st call: getServerKey GET
    fetchMock.mockResolvedValueOnce(okResponse({ srv0: {} }));
    // 2nd call: DELETE existing
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    // 3rd call: PUT new route at index 0 (insert; appending via POST would land
    // AFTER the static catch-all and be shadowed — see caddy-admin.ts:108-114)
    fetchMock.mockResolvedValueOnce(okResponse({}));

    const { addPreviewRoute } = await loadModule();
    await addPreviewRoute(validInput);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('http://caddy.test:2019/id/preview-my-app');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[2][0]).toBe('http://caddy.test:2019/config/apps/http/servers/srv0/routes/0');
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT');
  });

  it('includes correct route body shape', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ srv0: {} }));
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    fetchMock.mockResolvedValueOnce(okResponse({}));

    const { addPreviewRoute } = await loadModule();
    await addPreviewRoute(validInput);

    const postCall = fetchMock.mock.calls[2];
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body['@id']).toBe('preview-my-app');
    expect(body.match[0].host).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.preview.devdock.example.com']);
    expect(body.handle[0].handler).toBe('reverse_proxy');
    expect(body.handle[0].upstreams[0].dial).toBe('devdock-my-app-dev:3000');
    expect(body.terminal).toBe(true);
  });

  it('rejects invalid container name', async () => {
    const { addPreviewRoute } = await loadModule();
    await expect(addPreviewRoute({ ...validInput, containerName: 'evil/../container' })).rejects.toThrow(/container name/i);
  });

  it('rejects invalid port', async () => {
    const { addPreviewRoute } = await loadModule();
    await expect(addPreviewRoute({ ...validInput, previewPort: 70000 })).rejects.toThrow(/port/i);
    await expect(addPreviewRoute({ ...validInput, previewPort: 0 })).rejects.toThrow(/port/i);
  });

  it('rejects invalid envId (non-UUID)', async () => {
    const { addPreviewRoute } = await loadModule();
    await expect(addPreviewRoute({ ...validInput, envId: 'not-a-uuid' })).rejects.toThrow(/uuid|envId/i);
  });
});

describe('removePreviewRoute', () => {
  it('returns normally on 200', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}));
    const { removePreviewRoute } = await loadModule();
    await expect(removePreviewRoute('my-app')).resolves.toBeUndefined();
  });

  it('returns normally on 404 (idempotent delete)', async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    const { removePreviewRoute } = await loadModule();
    await expect(removePreviewRoute('my-app')).resolves.toBeUndefined();
  });

  it('throws on 500', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'internal error'));
    const { removePreviewRoute } = await loadModule();
    await expect(removePreviewRoute('my-app')).rejects.toThrow(/caddy/i);
  });
});
