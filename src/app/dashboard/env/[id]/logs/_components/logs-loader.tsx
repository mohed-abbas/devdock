'use client';

import dynamic from 'next/dynamic';

// Dynamic import with SSR disabled (xterm/Socket.IO require browser APIs)
const LogsClient = dynamic(
  () => import('./logs-client').then(mod => ({ default: mod.LogsClient })),
  { ssr: false, loading: () => <LogsSkeleton /> }
);

function LogsSkeleton() {
  return (
    <div className="flex flex-col h-svh">
      <div className="h-12 bg-card border-b border-border" />
      <div className="flex-1 bg-background" />
    </div>
  );
}

interface LogsLoaderProps {
  environmentId: string;
  environmentName: string;
  environmentStatus: string;
}

export function LogsLoader(props: LogsLoaderProps) {
  return <LogsClient {...props} />;
}
