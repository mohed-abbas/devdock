'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus } from 'lucide-react';
import { useGitHubConnection } from '@/hooks/use-github-connection';
import { RepoCombobox } from './repo-combobox';
import { BranchSelect } from './branch-select';
import type { RepoItem } from '@/hooks/use-github-repos';
import Link from 'next/link';

interface CreateEnvironmentDialogProps {
  onCreated: () => void;
}

export function CreateEnvironmentDialog({ onCreated }: CreateEnvironmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enablePostgres, setEnablePostgres] = useState(false);
  const [enableRedis, setEnableRedis] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const { connected, loading: connectionLoading } = useGitHubConnection();

  function resetForm() {
    setError(null);
    setSubmitting(false);
    setEnablePostgres(false);
    setEnableRedis(false);
    setSelectedRepo(null);
    setSelectedBranch('');
    setManualMode(false);
    formRef.current?.reset();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  function handleRepoSelect(repo: RepoItem | null) {
    setSelectedRepo(repo);
    if (repo) {
      setSelectedBranch(repo.defaultBranch);
    } else {
      setSelectedBranch('');
    }
  }

  function switchToManual() {
    setManualMode(true);
    setSelectedRepo(null);
    setSelectedBranch('');
  }

  function switchToGitHub() {
    setManualMode(false);
    // Manual URL will be cleared by form reset of that field
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const manualRepoUrl = (formData.get('repoUrl') as string | null)?.trim() ?? '';

    // Client-side validation
    if (!name) {
      setError('Name is required.');
      return;
    }

    // Validate manual URL if in manual mode
    if (showManualInput && manualRepoUrl) {
      try {
        new URL(manualRepoUrl);
      } catch {
        setError('Please enter a valid URL.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          repoUrl: selectedRepo ? selectedRepo.cloneUrl : (manualRepoUrl || undefined),
          branch: selectedRepo ? selectedBranch : undefined,
          enablePostgres,
          enableRedis,
        }),
      });

      if (res.status === 202 || res.ok) {
        setOpen(false);
        resetForm();
        onCreated();
        return;
      }

      const data = await res.json();
      if (res.status === 400 || res.status === 409 || res.status === 429) {
        setError(data.error || 'Failed to create environment. Please try again.');
      } else {
        setError('Failed to create environment. Please try again.');
      }
    } catch {
      setError('Failed to create environment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Determine which mode to show
  const showManualInput = !connected || manualMode || connectionLoading;
  const showCombobox = connected && !manualMode && !connectionLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button />}
      >
        <Plus className="size-4" />
        New Environment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
          <DialogDescription>
            Set up a new isolated development environment.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="env-name">Name</Label>
            <Input
              id="env-name"
              name="name"
              required
              placeholder="my-project"
              autoFocus
            />
          </div>

          {showCombobox && (
            <div className="space-y-2">
              <Label>Repository</Label>
              <RepoCombobox
                value={selectedRepo?.fullName ?? null}
                onSelect={handleRepoSelect}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={switchToManual}
                className="text-sm text-muted-foreground underline cursor-pointer mt-2"
              >
                Enter URL manually
              </button>
              {selectedRepo && (
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <BranchSelect
                    owner={selectedRepo.fullName.split('/')[0]}
                    repo={selectedRepo.fullName.split('/')[1]}
                    defaultBranch={selectedRepo.defaultBranch}
                    value={selectedBranch}
                    onChange={setSelectedBranch}
                  />
                </div>
              )}
            </div>
          )}

          {showManualInput && (
            <div className="space-y-2">
              <Label htmlFor="env-repo-url">Git Repository URL</Label>
              <Input
                id="env-repo-url"
                name="repoUrl"
                type="url"
                placeholder="https://github.com/user/repo.git"
              />
              {connected && manualMode && (
                <button
                  type="button"
                  onClick={switchToGitHub}
                  className="text-sm text-muted-foreground underline cursor-pointer mt-2"
                >
                  Select from GitHub
                </button>
              )}
              {!connected && !connectionLoading && (
                <p className="text-sm text-muted-foreground mt-1">
                  Connect GitHub in{' '}
                  <Link
                    href="/dashboard/settings"
                    className="text-primary underline"
                  >
                    Settings
                  </Link>{' '}
                  to browse your repos.
                </p>
              )}
            </div>
          )}

          <Separator />
          <div className="space-y-3">
            <Label>Sidecar Services</Label>
            <div className="flex items-start gap-3">
              <Checkbox
                id="env-postgres"
                checked={enablePostgres}
                onCheckedChange={(checked) => setEnablePostgres(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="env-postgres" className="text-sm font-medium">
                  PostgreSQL
                </Label>
                <p className="text-sm text-muted-foreground">
                  PostgreSQL 16 database
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="env-redis"
                checked={enableRedis}
                onCheckedChange={(checked) => setEnableRedis(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="env-redis" className="text-sm font-medium">
                  Redis
                </Label>
                <p className="text-sm text-muted-foreground">
                  Redis 7 cache
                </p>
              </div>
            </div>
          </div>
          <div aria-live="polite" className="min-h-[20px]">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Discard
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create & Start'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
