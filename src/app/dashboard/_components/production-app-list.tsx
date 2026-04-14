'use client';

import { useProductionApps } from '@/hooks/use-production-apps';
import { ProductionAppCard } from './production-app-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export function ProductionAppList() {
  const { apps, loading, enabled } = useProductionApps();

  // D-05: hide section entirely when no apps or not enabled
  if (!loading && (apps.length === 0 || !enabled)) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <>
        <Separator className="my-8" />
        <section>
          <div className="flex items-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Production Apps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-24">
                <Skeleton className="h-full w-full rounded-xl" />
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Separator className="my-8" />
      <section>
        <div className="flex items-center mb-6">
          <h2 className="text-xl font-semibold text-foreground">Production Apps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map((app) => (
            <ProductionAppCard key={app.name} app={app} />
          ))}
        </div>
      </section>
    </>
  );
}
