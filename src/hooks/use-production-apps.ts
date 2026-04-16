'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProductionApp {
  name: string;
  status: 'running' | 'stopped' | 'partial';
  containerCount: number;
  uptimeMs: number | null;
  exposedPorts: string[];
}

export function useProductionApps(pollInterval = 5000) {
  const [apps, setApps] = useState<ProductionApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const enabledRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch('/api/production-apps');
      if (!res.ok) {
        // If 404 or error, production feature may be disabled
        enabledRef.current = false;
        setEnabled(false);
        return;
      }
      const data = await res.json();
      setApps(data);
      enabledRef.current = true;
      setEnabled(true);
    } catch {
      // Silent retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();

    intervalRef.current = setInterval(() => {
      if (!enabledRef.current) return;
      if (document.visibilityState === 'visible') {
        fetchApps();
      }
    }, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchApps, pollInterval]);

  return { apps, loading, enabled };
}
