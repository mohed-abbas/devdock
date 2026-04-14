'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';

interface HeaderNavProps {
  username?: string;
}

export function HeaderNav({ username }: HeaderNavProps) {
  const pathname = usePathname();
  const isSettings = pathname === '/dashboard/settings';

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/dashboard/settings"
        className={`flex items-center gap-1.5 text-sm transition-colors hover:text-foreground ${
          isSettings ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        <Settings className="size-4" />
        <span className="hidden sm:inline">Settings</span>
      </Link>
      <span className="hidden sm:block text-sm text-muted-foreground">
        {username}
      </span>
      <LogoutButton />
    </div>
  );
}
