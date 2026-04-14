'use client';

import { useState, useCallback } from 'react';

export interface BranchItem {
  name: string;
  protected: boolean;
}

export function useGitHubBranches() {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBranches = useCallback(async (owner: string, repo: string) => {
    setLoading(true);
    setBranches([]);
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/branches`);
      if (res.ok) {
        const data: BranchItem[] = await res.json();
        setBranches(data);
      }
    } catch {
      // Silently fail, branch selector will be empty
    } finally {
      setLoading(false);
    }
  }, []);

  return { branches, loading, fetchBranches };
}
