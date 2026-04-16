'use client';

import { useState, useCallback, useRef } from 'react';

export interface RepoItem {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  pushedAt: string | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes client-side cache

export function useGitHubRepos() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const cacheRef = useRef<{ data: RepoItem[]; expiry: number } | null>(null);

  const fetchRepos = useCallback(async () => {
    // Check client-side cache
    if (cacheRef.current && Date.now() < cacheRef.current.expiry) {
      setRepos(cacheRef.current.data);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github/repos');
      if (res.status === 401) {
        const data = await res.json();
        if (data.expired) {
          setExpired(true);
          setError('GitHub token expired. Reconnect in Settings.');
          setRepos([]);
          return;
        }
      }
      if (!res.ok) {
        setError('Failed to load repositories.');
        return;
      }
      const data: RepoItem[] = await res.json();
      setRepos(data);
      cacheRef.current = { data, expiry: Date.now() + CACHE_TTL };
    } catch {
      setError('Failed to load repositories.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { repos, loading, error, expired, fetchRepos };
}
