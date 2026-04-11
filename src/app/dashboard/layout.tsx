import { LogoutButton } from '@/components/auth/logout-button';
import { auth } from '@/auth';

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
        <div className="flex items-center gap-4">
          {/* Username hidden on mobile, shown on sm+ per UI-SPEC responsive */}
          <span className="hidden sm:block text-sm text-muted-foreground">
            {session?.user?.name}
          </span>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
