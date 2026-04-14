'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ChevronLeft, ArrowDownToLine, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { StatusBadge } from '@/app/dashboard/_components/status-badge';
import type { EnvironmentStatus } from '@/lib/docker/types';

interface LogsClientProps {
  environmentId: string;
  environmentName: string;
  environmentStatus: string;
}

// Simple ANSI strip regex (per RESEARCH recommendation — strip, don't render)
const ANSI_REGEX = /\x1B\[[0-9;]*[A-Za-z]/g;

export function LogsClient({
  environmentId,
  environmentName,
  environmentStatus,
}: LogsClientProps) {
  const [logLines, setLogLines] = useState<string[]>([]);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  >('connecting');
  const [autoScroll, setAutoScroll] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logLines, autoScroll]);

  const connect = useCallback(async () => {
    setConnectionState('connecting');

    // Fetch HMAC token from environment-scoped route
    let token: string;
    try {
      const res = await fetch(`/api/environments/${environmentId}/logs/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        setConnectionState('disconnected');
        return;
      }
      const data = await res.json();
      token = data.token;
    } catch {
      setConnectionState('disconnected');
      return;
    }

    // Connect to Socket.IO /logs namespace on same path as terminal
    const socket = io('/logs', {
      path: '/ws/socket.io',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
    });

    socket.on('logs:data', (payload: { data: string }) => {
      const cleaned = payload.data.replace(ANSI_REGEX, '');
      // Split by newlines to get individual lines, filter empty trailing
      const newLines = cleaned.split('\n').filter((line, i, arr) =>
        i < arr.length - 1 || line.length > 0
      );
      setLogLines((prev) => {
        const combined = [...prev, ...newLines];
        // Keep max 5000 lines in browser memory (T-06-09: DoS prevention)
        return combined.length > 5000 ? combined.slice(-5000) : combined;
      });
    });

    socket.on('logs:end', () => {
      // Container stopped — stream ended
      setConnectionState('disconnected');
    });

    socket.on('logs:error', () => {
      setConnectionState('disconnected');
    });

    socket.on('disconnect', () => {
      setConnectionState('reconnecting');
    });

    socket.on('reconnect_failed', () => {
      setConnectionState('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionState('disconnected');
    });
  }, [environmentId]);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  function handleClear() {
    setLogLines([]);
  }

  function handleRetry() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setLogLines([]);
    connect();
  }

  return (
    <div className="flex flex-col h-svh">
      {/* Header bar — mirrors terminal header per UI-SPEC */}
      <div className="h-12 bg-card border-b border-border flex items-center px-4 gap-2 z-50">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="size-4" />
          </Button>
        </Link>
        <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
          {environmentName}
        </span>
        <StatusBadge status={environmentStatus as EnvironmentStatus} />
        <div className="ml-auto flex items-center gap-2">
          {connectionState === 'connecting' && (
            <Loader2 className="size-4 text-muted-foreground animate-spin" />
          )}
          <Button
            variant={autoScroll ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll on' : 'Scroll paused'}
            aria-label={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            <ArrowDownToLine className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            title="Clear logs"
            aria-label="Clear logs"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Log output area */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto bg-background p-4 font-mono text-[13px] relative"
      >
        {/* Empty state */}
        {logLines.length === 0 && connectionState === 'connected' && (
          <div className="text-muted-foreground">Waiting for log output...</div>
        )}

        {/* Log lines */}
        {logLines.map((line, i) => (
          <div
            key={i}
            className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-all"
          >
            {line || '\u00A0'}
          </div>
        ))}

        {/* Reconnecting overlay */}
        {connectionState === 'reconnecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-center">
              <Loader2 className="size-6 text-amber-400 animate-spin mx-auto mb-2" />
              <p className="text-amber-400 text-sm">Reconnecting to log stream...</p>
            </div>
          </div>
        )}

        {/* Disconnected overlay */}
        {connectionState === 'disconnected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-center space-y-3">
              <h3 className="text-foreground font-semibold">Connection lost</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Could not connect to the log stream. Check that the environment is running.
              </p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry connection
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
