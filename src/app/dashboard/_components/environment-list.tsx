'use client';

import { useEnvironments } from '@/hooks/use-environments';
import { EnvironmentCard } from './environment-card';
import { CreateEnvironmentDialog } from './create-environment-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Server } from 'lucide-react';

export function EnvironmentList() {
  const { environments, loading, refetch } = useEnvironments();

  // Loading state: show skeleton cards
  if (loading && environments.length === 0) {
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-foreground">Environments</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
          ))}
        </div>
      </>
    );
  }

  // Empty state: no environments
  if (!loading && environments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <Server className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground mt-4">
          No environments yet
        </h2>
        <p className="text-base text-muted-foreground mt-2 text-center max-w-sm">
          Create your first development environment to get started.
        </p>
        <div className="mt-6">
          <CreateEnvironmentDialog onCreated={refetch} />
        </div>
      </div>
    );
  }

  // Has environments: header + card grid
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-foreground">Environments</h1>
        <CreateEnvironmentDialog onCreated={refetch} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {environments.map((env) => (
          <EnvironmentCard key={env.id} environment={env} onRefetch={refetch} />
        ))}
      </div>
    </>
  );
}
