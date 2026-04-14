'use client';

import { useEffect, useMemo } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useGitHubBranches } from '@/hooks/use-github-branches';

interface BranchSelectProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  value: string;
  onChange: (branch: string) => void;
}

export function BranchSelect({
  owner,
  repo,
  defaultBranch,
  value,
  onChange,
}: BranchSelectProps) {
  const { branches, loading, fetchBranches } = useGitHubBranches();

  useEffect(() => {
    if (owner && repo) {
      fetchBranches(owner, repo);
    }
  }, [owner, repo, fetchBranches]);

  const sortedBranches = useMemo(() => {
    if (!branches.length) return [];
    // Default branch first, then alphabetical
    return [...branches].sort((a, b) => {
      if (a.name === defaultBranch) return -1;
      if (b.name === defaultBranch) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [branches, defaultBranch]);

  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v); }} disabled={loading}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {loading ? 'Loading branches...' : value || 'Select a branch'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sortedBranches.map((branch) => (
          <SelectItem key={branch.name} value={branch.name}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
