'use client';

import { useState, useEffect } from 'react';
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
import { Pencil } from 'lucide-react';
import type { Environment } from '@/hooks/use-environments';

interface EditEnvironmentDialogProps {
  environment: Environment;
  onUpdated: () => void;
  disabled: boolean;
}

export function EditEnvironmentDialog({
  environment,
  onUpdated,
  disabled,
}: EditEnvironmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(environment.name);
  const [previewPort, setPreviewPort] = useState(
    environment.previewPort?.toString() ?? '3000'
  );

  // Sync state when environment changes or dialog opens.
  // When previewPort is unset, propose 3000 so the user can accept the
  // common dev-server default with a single Save click.
  useEffect(() => {
    if (open) {
      setName(environment.name);
      setPreviewPort(environment.previewPort?.toString() ?? '3000');
      setError(null);
    }
  }, [open, environment.name, environment.previewPort]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (previewPort) {
      const port = parseInt(previewPort, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        setError('Preview port must be between 1 and 65535.');
        return;
      }
    }

    // Skip if nothing changed
    const newPort = previewPort ? parseInt(previewPort, 10) : null;
    if (trimmedName === environment.name && newPort === environment.previewPort) {
      setOpen(false);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/environments/${environment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          previewPort: newPort,
        }),
      });

      if (res.ok || res.status === 202) {
        setOpen(false);
        onUpdated();
        return;
      }

      const data = await res.json();
      setError(data.error || 'Failed to update environment.');
    } catch {
      setError('Failed to update environment.');
    } finally {
      setSubmitting(false);
    }
  }

  const isRunning = environment.status === 'running';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label="Edit environment"
            title="Edit environment"
          />
        }
      >
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit Environment</DialogTitle>
          <DialogDescription>
            Update environment settings.
            {isRunning && ' The environment will restart to apply changes.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-env-name">Name</Label>
            <Input
              id="edit-env-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-env-preview-port">Preview Port</Label>
            <Input
              id="edit-env-preview-port"
              type="number"
              min={1}
              max={65535}
              placeholder="3000"
              value={previewPort}
              onChange={(e) => setPreviewPort(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {environment.previewPort === null
                ? 'Currently unset. Defaulting to 3000 — clear to keep unset, or change to your dev server’s port.'
                : 'Port your app listens on inside the container.'}
            </p>
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
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Saving...'
                : isRunning
                  ? 'Save & Restart'
                  : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
