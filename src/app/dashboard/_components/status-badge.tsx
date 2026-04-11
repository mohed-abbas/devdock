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

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-2 py-1',
        config.bg,
        className
      )}
      title={status === 'error' && errorMessage ? errorMessage : undefined}
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
    </span>
  );
}
