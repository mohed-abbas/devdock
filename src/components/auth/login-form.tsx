'use client';

import { useActionState, useRef, useEffect } from 'react';
import { login } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, { error: null });
  const usernameRef = useRef<HTMLInputElement>(null);

  // After error, focus returns to username input (UI-SPEC accessibility)
  useEffect(() => {
    if (state.error && usernameRef.current) {
      usernameRef.current.focus();
    }
  }, [state.error]);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              ref={usernameRef}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {/* Fixed-height error region to prevent layout shift (UI-SPEC) */}
          <div className="min-h-[20px]" aria-live="polite" aria-atomic="true">
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full h-11"
            disabled={isPending}
          >
            {isPending ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
