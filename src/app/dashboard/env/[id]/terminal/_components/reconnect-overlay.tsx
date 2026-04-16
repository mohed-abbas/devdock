'use client';

import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ReconnectOverlayProps {
  state: 'connected' | 'reconnecting' | 'disconnected';
  onRetry: () => void;
}

export function ReconnectOverlay({ state, onRetry }: ReconnectOverlayProps) {
  if (state === 'connected') return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-lg p-6 max-w-sm text-center shadow-lg" aria-live="assertive">
        {state === 'reconnecting' && (
          <>
            <RefreshCw className="size-8 text-muted-foreground animate-spin mx-auto" />
            <h2 className="text-xl font-semibold text-foreground mt-4">
              Reconnecting...
            </h2>
            <p className="text-base text-muted-foreground mt-2">
              Attempting to restore terminal session.
            </p>
          </>
        )}
        {state === 'disconnected' && (
          <>
            <AlertCircle className="size-8 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold text-destructive mt-4">
              Connection lost
            </h2>
            <p className="text-base text-muted-foreground mt-2">
              The terminal session could not be restored.
            </p>
            <Button variant="default" className="mt-4" onClick={onRetry}>
              Retry connection
            </Button>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground underline mt-2 block"
            >
              Back to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
