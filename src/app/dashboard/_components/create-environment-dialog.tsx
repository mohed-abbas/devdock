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

interface CreateEnvironmentDialogProps {
  onCreated: () => void;
}

export function CreateEnvironmentDialog({ onCreated }: CreateEnvironmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enablePostgres, setEnablePostgres] = useState(false);
  const [enableRedis, setEnableRedis] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function resetForm() {
    setError(null);
    setSubmitting(false);
    setEnablePostgres(false);
    setEnableRedis(false);
    formRef.current?.reset();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const repoUrl = (formData.get('repoUrl') as string).trim();

    // Client-side validation
    if (!name) {
      setError('Name is required.');
      return;
    }

    if (repoUrl) {
      try {
        new URL(repoUrl);
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
          repoUrl: repoUrl || undefined,
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
          <div className="space-y-2">
            <Label htmlFor="env-repo-url">Git Repository URL</Label>
            <Input
              id="env-repo-url"
              name="repoUrl"
              type="url"
              placeholder="https://github.com/user/repo.git"
            />
          </div>
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
