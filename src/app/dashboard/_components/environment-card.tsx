'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { DeleteEnvironmentDialog } from './delete-environment-dialog';
import { Play, Square, Trash2, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import type { Environment } from '@/hooks/use-environments';

interface EnvironmentCardProps {
  environment: Environment;
  onRefetch: () => void;
}

export function EnvironmentCard({ environment, onRefetch }: EnvironmentCardProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isTransitioning = environment.status === 'starting' || environment.status === 'stopping';
  const canStart = environment.status === 'stopped' || environment.status === 'error';
  const canStop = environment.status === 'running';
  const canDelete = !isTransitioning;

  async function handleStart() {
    setActionLoading('start');
    try {
      const res = await fetch(`/api/environments/${environment.id}/start`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        console.error('Start failed:', data.error);
      }
      onRefetch();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStop() {
    setActionLoading('stop');
    try {
      const res = await fetch(`/api/environments/${environment.id}/stop`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        console.error('Stop failed:', data.error);
      }
      onRefetch();
    } finally {
      setActionLoading(null);
    }
  }

  function formatRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="font-semibold text-sm text-card-foreground">
            {environment.name}
          </CardTitle>
          {environment.repoUrl && (
            <CardDescription className="truncate max-w-[200px]">
              {environment.repoUrl}
            </CardDescription>
          )}
        </div>
        <CardAction>
          <StatusBadge
            status={environment.status}
            errorMessage={environment.errorMessage}
          />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(environment.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {environment.status === 'running' && (
            <Link
              href={`/dashboard/env/${environment.id}/terminal`}
              aria-label="Open terminal"
              title="Open terminal"
            >
              <Button variant="outline" size="sm">
                <TerminalSquare className="size-4" />
              </Button>
            </Link>
          )}
          {canStart && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStart}
              disabled={actionLoading !== null}
              aria-label="Start environment"
              title="Start environment"
            >
              <Play className="size-4" />
            </Button>
          )}
          {canStop && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              disabled={actionLoading !== null}
              aria-label="Stop environment"
              title="Stop environment"
            >
              <Square className="size-4" />
            </Button>
          )}
          <DeleteEnvironmentDialog
            environment={environment}
            onDeleted={onRefetch}
            disabled={!canDelete || actionLoading !== null}
          />
        </div>
      </CardFooter>
    </Card>
  );
}
