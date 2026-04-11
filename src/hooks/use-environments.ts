'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { EnvironmentStatus } from '@/lib/docker/types';

export interface Environment {
  id: string;
  name: string;
  slug: string;
  repoUrl: string | null;
  status: EnvironmentStatus;
  errorMessage: string | null;
  composeConfig: { enablePostgres: boolean; enableRedis: boolean } | null;
  dockerProjectName: string | null;
  networkName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useEnvironments(pollInterval = 3000) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch('/api/environments');
      if (!res.ok) {
        throw new Error('Failed to fetch environments');
      }
      const data = await res.json();
      setEnvironments(data);
      setError(null);
    } catch {
      // Silent retry on next interval per UI-SPEC polling behavior
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();

    intervalRef.current = setInterval(() => {
      // Skip polling when tab is hidden (per UI-SPEC optimization)
      if (document.visibilityState === 'visible') {
        fetchEnvironments();
      }
    }, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEnvironments, pollInterval]);

  return { environments, loading, error, refetch: fetchEnvironments };
}
