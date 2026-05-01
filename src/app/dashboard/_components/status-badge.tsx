'use client';

import type { EnvironmentStatus } from '@/lib/docker/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<EnvironmentStatus, { bg: string; text: string; dot: string; pulse: boolean }> = {
  running: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500', pulse: false },
  stopped: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', pulse: false },
  starting: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500', pulse: true },
  stopping: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500', pulse: true },
  error: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', pulse: false },
};

interface StatusBadgeProps {
  status: EnvironmentStatus;
  errorMessage?: string | null;
  className?: string;
}

export function StatusBadge({ status, errorMessage, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  // Surface errorMessage for both 'error' (start failed) and 'running' (env
  // is up but a non-fatal warning is set — e.g. preview routing failed to
  // register with Caddy). For 'running' we add a small warning indicator
  // so users can see something needs attention without a full status flip.
  const hasWarning = status === 'running' && Boolean(errorMessage);
  const tooltip = errorMessage && (status === 'error' || hasWarning) ? errorMessage : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2 py-1',
        config.bg,
        className
      )}
      title={tooltip}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          config.dot,
          config.pulse && 'animate-pulse'
        )}
      />
      <span className={cn('text-sm font-semibold uppercase tracking-wide', config.text)}>
        {status === 'error' ? 'Error' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      {hasWarning && (
        <span
          aria-hidden="true"
          className="inline-flex size-4 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400"
        >
          !
        </span>
      )}
    </span>
  );
}
