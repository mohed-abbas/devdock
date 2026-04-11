'use client';

import { logout } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button variant="ghost" size="sm" type="submit">
        Sign Out
      </Button>
    </form>
  );
}
