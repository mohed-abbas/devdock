'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { Environment } from '@/hooks/use-environments';

interface DeleteEnvironmentDialogProps {
  environment: Environment;
  onDeleted: () => void;
  disabled: boolean;
}

export function DeleteEnvironmentDialog({
  environment,
  onDeleted,
  disabled,
}: DeleteEnvironmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/environments/${environment.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setOpen(false);
        onDeleted();
      } else {
        // Error handled via card status on next poll
        setOpen(false);
      }
    } catch {
      setOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            disabled={disabled}
            aria-label="Delete environment"
            title="Delete environment"
          />
        }
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete ${environment.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the environment, its containers, network,
            volumes, and workspace files. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            Keep Environment
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Environment'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
