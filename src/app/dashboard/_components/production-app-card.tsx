'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './status-badge';
import type { ProductionApp } from '@/hooks/use-production-apps';
import type { EnvironmentStatus } from '@/lib/docker/types';

interface ProductionAppCardProps {
  app: ProductionApp;
}

function formatUptime(uptimeMs: number | null): string {
  if (uptimeMs === null) return 'N/A';
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

function mapStatus(status: ProductionApp['status']): EnvironmentStatus {
  if (status === 'running') return 'running';
  if (status === 'stopped') return 'stopped';
  return 'starting'; // 'partial' maps to starting (amber indicator)
}

export function ProductionAppCard({ app }: ProductionAppCardProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="font-semibold text-sm text-card-foreground">
            {app.name}
          </CardTitle>
          <CardDescription>
            Uptime: {formatUptime(app.uptimeMs)}
            {app.exposedPorts.length > 0 && (
              <>  &middot;  Ports: {app.exposedPorts.join(', ')}</>
            )}
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs"
          >
            Production
          </Badge>
          <StatusBadge status={mapStatus(app.status)} />
        </CardAction>
      </CardHeader>
      {/* No CardFooter — read-only card per D-04 */}
    </Card>
  );
}
