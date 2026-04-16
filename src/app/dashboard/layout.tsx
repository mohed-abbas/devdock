import { auth } from '@/auth';
import { HeaderNav } from './_components/header-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-svh flex flex-col">
      {/* Sticky header per UI-SPEC */}
      <header className="sticky top-0 z-50 h-16 border-b border-border bg-card px-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">DevDock</span>
        <HeaderNav username={session?.user?.name ?? undefined} />
      </header>
      {children}
    </div>
  );
}
