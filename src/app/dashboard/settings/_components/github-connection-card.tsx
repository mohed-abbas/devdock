'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { useGitHubConnection } from '@/hooks/use-github-connection';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export function GitHubConnectionCard() {
  const { connected, username, avatarUrl, loading, refetch } =
    useGitHubConnection();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Handle OAuth redirect params for toast notifications
  useEffect(() => {
    const success = searchParams.get('github_success');
    const error = searchParams.get('github_error');

    if (success === 'true') {
      toast.success('GitHub connected.');
      // Clean URL params without reload
      window.history.replaceState({}, '', '/dashboard/settings');
    } else if (error) {
      toast.error('Failed to connect GitHub. Please try again.');
      window.history.replaceState({}, '', '/dashboard/settings');
    }
  }, [searchParams]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/github/disconnect', { method: 'POST' });
      if (res.ok) {
        toast.success('GitHub disconnected.');
        await refetch();
      } else {
        toast.error('Failed to disconnect GitHub. Please try again.');
      }
    } catch {
      toast.error('Failed to disconnect GitHub. Please try again.');
    } finally {
      setDisconnecting(false);
      setDialogOpen(false);
    }
  }

  function handleConnect() {
    window.location.href = '/api/github/authorize';
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub</CardTitle>
        <CardDescription>
          Connect your GitHub account to browse and clone repositories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage
                src={avatarUrl}
                alt={`${username}'s GitHub avatar`}
              />
              <AvatarFallback>
                {username ? username[0].toUpperCase() : 'G'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-foreground">
              {username}
            </span>
            <Badge
              variant="outline"
              className="text-emerald-400 border-emerald-400/30"
            >
              Connected
            </Badge>
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                  />
                }
              >
                Disconnect
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your existing environments will keep their cloned code, but
                    you won&apos;t be able to browse repositories or clone new
                    ones until you reconnect.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Connected</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={disconnecting}
                    onClick={handleDisconnect}
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Button onClick={handleConnect}>
            <GitHubIcon className="size-4" />
            Connect GitHub
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
