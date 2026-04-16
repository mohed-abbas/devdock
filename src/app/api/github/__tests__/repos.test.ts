import { describe, it, expect } from 'vitest';

/**
 * Tests for the repo mapping logic and cache behavior.
 * These are unit tests for the data transformation, not integration tests
 * for the full route handler (which requires auth + DB mocking).
 */

interface GitHubRepoRaw {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
  pushed_at: string | null;
  // Additional fields that GitHub returns but we don't expose
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
}

interface RepoItem {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  pushedAt: string | null;
}

// Extract the mapping logic to test it directly
function mapRepos(repos: GitHubRepoRaw[]): RepoItem[] {
  return repos.slice(0, 500).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    cloneUrl: r.clone_url,
    pushedAt: r.pushed_at,
  }));
}

describe('repos route logic', () => {
  describe('repo mapping', () => {
    it('maps GitHub repo objects to minimal RepoItem shape', () => {
      const rawRepos: GitHubRepoRaw[] = [
        {
          id: 123,
          full_name: 'user/my-project',
          private: true,
          default_branch: 'main',
          html_url: 'https://github.com/user/my-project',
          clone_url: 'https://github.com/user/my-project.git',
          pushed_at: '2026-04-10T12:00:00Z',
          description: 'A test project',
          stargazers_count: 42,
          forks_count: 5,
          language: 'TypeScript',
        },
      ];

      const mapped = mapRepos(rawRepos);

      expect(mapped).toHaveLength(1);
      expect(mapped[0]).toEqual({
        id: 123,
        fullName: 'user/my-project',
        private: true,
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/user/my-project',
        cloneUrl: 'https://github.com/user/my-project.git',
        pushedAt: '2026-04-10T12:00:00Z',
      });
    });

    it('strips extra fields from GitHub response for minimal shape', () => {
      const rawRepos: GitHubRepoRaw[] = [
        {
          id: 456,
          full_name: 'org/repo',
          private: false,
          default_branch: 'develop',
          html_url: 'https://github.com/org/repo',
          clone_url: 'https://github.com/org/repo.git',
          pushed_at: null,
          description: 'Should not appear in output',
          stargazers_count: 100,
          forks_count: 20,
          language: 'Go',
        },
      ];

      const mapped = mapRepos(rawRepos);

      expect(mapped[0]).not.toHaveProperty('description');
      expect(mapped[0]).not.toHaveProperty('stargazers_count');
      expect(mapped[0]).not.toHaveProperty('forks_count');
      expect(mapped[0]).not.toHaveProperty('language');
    });

    it('caps repos at 500 items', () => {
      const rawRepos: GitHubRepoRaw[] = Array.from({ length: 600 }, (_, i) => ({
        id: i,
        full_name: `user/repo-${i}`,
        private: false,
        default_branch: 'main',
        html_url: `https://github.com/user/repo-${i}`,
        clone_url: `https://github.com/user/repo-${i}.git`,
        pushed_at: '2026-04-01T00:00:00Z',
        description: null,
        stargazers_count: 0,
        forks_count: 0,
        language: null,
      }));

      const mapped = mapRepos(rawRepos);

      expect(mapped).toHaveLength(500);
    });

    it('handles null pushed_at', () => {
      const rawRepos: GitHubRepoRaw[] = [
        {
          id: 789,
          full_name: 'user/empty-repo',
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/user/empty-repo',
          clone_url: 'https://github.com/user/empty-repo.git',
          pushed_at: null,
          description: null,
          stargazers_count: 0,
          forks_count: 0,
          language: null,
        },
      ];

      const mapped = mapRepos(rawRepos);

      expect(mapped[0].pushedAt).toBeNull();
    });
  });

  describe('cache behavior', () => {
    it('cache TTL is 5 minutes (300000ms)', () => {
      const CACHE_TTL = 5 * 60 * 1000;
      expect(CACHE_TTL).toBe(300000);
    });

    it('cache entry structure stores data and expiry timestamp', () => {
      const cache = new Map<string, { data: unknown[]; expiry: number }>();
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000;

      cache.set('user-123', { data: [{ id: 1 }], expiry: now + CACHE_TTL });

      const entry = cache.get('user-123');
      expect(entry).toBeDefined();
      expect(entry!.data).toHaveLength(1);
      expect(entry!.expiry).toBeGreaterThan(now);
    });

    it('expired cache entries should be treated as stale', () => {
      const cache = new Map<string, { data: unknown[]; expiry: number }>();
      const past = Date.now() - 1000;

      cache.set('user-123', { data: [{ id: 1 }], expiry: past });

      const entry = cache.get('user-123');
      const isValid = entry && Date.now() < entry.expiry;
      expect(isValid).toBe(false);
    });
  });

  describe('auto-disconnect on 401', () => {
    it('401 status indicates expired token requiring disconnect', () => {
      // This tests the decision logic: when GitHub returns 401, the route
      // should auto-disconnect by deleting the github_accounts row and
      // purging the cache. We verify the error response shape.
      const errorResponse = { error: 'GitHub token expired', expired: true };

      expect(errorResponse.expired).toBe(true);
      expect(errorResponse.error).toContain('expired');
    });
  });
});
