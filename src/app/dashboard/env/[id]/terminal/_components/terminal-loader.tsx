'use client';

import dynamic from 'next/dynamic';

// Dynamic import with SSR disabled (Pitfall 6: xterm.js requires browser APIs)
const TerminalClient = dynamic(
  () => import('./terminal-client').then(mod => ({ default: mod.TerminalClient })),
  { ssr: false, loading: () => <TerminalSkeleton /> }
);

function TerminalSkeleton() {
  return (
    <div className="flex flex-col h-svh">
      <div className="h-12 bg-card border-b border-border" />
      <div className="h-8 bg-card border-b border-border" />
      <div className="flex-1 bg-background" />
    </div>
  );
}

interface TerminalLoaderProps {
  environmentId: string;
  environmentName: string;
  environmentStatus: string;
}

export function TerminalLoader(props: TerminalLoaderProps) {
  return <TerminalClient {...props} />;
}
