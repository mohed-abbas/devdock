'use client';

import { useState, useEffect, useCallback } from 'react';

interface GitHubConnection {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  connectedAt?: string;
}

export function useGitHubConnection() {
  const [data, setData] = useState<GitHubConnection>({ connected: false });
  const [loading, setLoading] = useState(true);

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/github/connection');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail, show not connected
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  return { ...data, loading, refetch: fetchConnection };
}
