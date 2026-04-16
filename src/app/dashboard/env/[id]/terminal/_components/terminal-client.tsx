'use client';

import { useState, useRef, useCallback, useEffect, createRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TerminalTabs } from './terminal-tabs';
import { TerminalInstance } from './terminal-instance';
import { ReconnectOverlay } from './reconnect-overlay';

interface TerminalClientProps {
  environmentId: string;
  environmentName: string;
  environmentStatus: string;
}

interface TabInfo {
  id: number;
  label: string;
  terminalRef: React.RefObject<Terminal | null>;
  sessionIndex: number | null;
}

const MAX_TABS = 5;

export function TerminalClient({
  environmentId,
  environmentName,
}: TerminalClientProps) {
  const router = useRouter();
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<number>(0);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'disconnected'
  >('connecting');
  const tabsRef = useRef<TabInfo[]>([]);
  tabsRef.current = tabs;
  const nextTabIdRef = useRef(1);
  const socketRef = useRef<Socket | null>(null);
  const pendingTabRef = useRef<number | null>(null);

  // Fetch token and connect socket
  const connect = useCallback(async () => {
    setConnectionState('connecting');

    let token: string;
    try {
      const res = await fetch('/api/terminal/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentId }),
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

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const terminalServerUrl = process.env.NEXT_PUBLIC_TERMINAL_URL || 'http://localhost:3001';
    const socket = io(`${terminalServerUrl}/terminal`, {
      path: '/ws/socket.io',
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
    });

    socket.on('disconnect', () => {
      setConnectionState('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setConnectionState('connected');
    });

    socket.io.on('reconnect_failed', () => {
      setConnectionState('disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionState('disconnected');
    });

    // Server created the exec session
    socket.on('exec:created', ({ sessionIndex }: { sessionIndex: number }) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === pendingTabRef.current
            ? { ...tab, sessionIndex }
            : tab
        )
      );
      pendingTabRef.current = null;
    });

    // Output from container
    socket.on('exec:output', ({ sessionIndex, data }: { sessionIndex: number; data: string }) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.sessionIndex === sessionIndex);
        if (tab?.terminalRef.current) {
          tab.terminalRef.current.write(data);
        }
        return prev;
      });
    });

    // Exec session ended
    socket.on('exec:exit', ({ sessionIndex }: { sessionIndex: number }) => {
      const tab = tabsRef.current.find((t) => t.sessionIndex === sessionIndex);
      if (tab) {
        closeTabById(tab.id);
      }
    });

    // Error from server
    socket.on('exec:error', ({ message }: { message: string }) => {
      // Write error to the pending tab's terminal if available
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === pendingTabRef.current) || prev[prev.length - 1];
        if (tab?.terminalRef.current) {
          tab.terminalRef.current.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
        }
        return prev;
      });
    });
  }, [environmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add a new tab and create exec session
  const addTab = useCallback(() => {
    const id = nextTabIdRef.current++;
    const label = `Terminal ${id}`;
    const terminalRef = createRef<Terminal | null>();
    (terminalRef as React.MutableRefObject<Terminal | null>).current = null;

    const newTab: TabInfo = { id, label, terminalRef, sessionIndex: null };
    pendingTabRef.current = id;

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);

    // Request exec session after a short delay to let the terminal mount and get dimensions
    setTimeout(() => {
      const term = terminalRef.current;
      const cols = term?.cols || 80;
      const rows = term?.rows || 24;
      socketRef.current?.emit('exec:create', { cols, rows });
    }, 100);
  }, []);

  // Close a tab by ID
  const closeTabById = useCallback((tabId: number) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (newTabs.length === 0) {
        // Last tab closed -- navigate to dashboard after render
        setTimeout(() => router.push('/dashboard'), 0);
        return [];
      }
      // Switch active tab if we closed the active one
      setActiveTabId((prevActive) => {
        if (prevActive === tabId) {
          const closedIdx = prev.findIndex((t) => t.id === tabId);
          const newIdx = Math.min(closedIdx, newTabs.length - 1);
          return newTabs[newIdx].id;
        }
        return prevActive;
      });
      return newTabs;
    });
  }, [router]);

  // Switch to a tab
  const switchTab = useCallback((tabId: number) => {
    setActiveTabId(tabId);
  }, []);

  // Rename a tab
  const renameTab = useCallback((tabId: number, newLabel: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, label: newLabel } : t)));
  }, []);

  // Handle terminal data input
  const handleData = useCallback((tabId: number, data: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab?.sessionIndex !== null && tab?.sessionIndex !== undefined) {
        socketRef.current?.emit('exec:input', { sessionIndex: tab.sessionIndex, data });
      }
      return prev;
    });
  }, []);

  // Handle terminal resize
  const handleResize = useCallback((tabId: number, cols: number, rows: number) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === tabId);
      if (tab?.sessionIndex !== null && tab?.sessionIndex !== undefined) {
        socketRef.current?.emit('exec:resize', { sessionIndex: tab.sessionIndex, cols, rows });
      }
      return prev;
    });
  }, []);

  // Retry connection
  const handleRetry = useCallback(() => {
    // Reset tabs
    setTabs([]);
    nextTabIdRef.current = 1;
    connect();
  }, [connect]);

  // Connect on mount, create first tab after connected
  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  // Create first tab once connected
  const firstTabCreated = useRef(false);
  useEffect(() => {
    if (connectionState === 'connected' && tabs.length === 0 && !firstTabCreated.current) {
      firstTabCreated.current = true;
      addTab();
    }
  }, [connectionState, tabs.length, addTab]);

  // Reset first tab flag on retry
  useEffect(() => {
    if (connectionState === 'connecting') {
      firstTabCreated.current = false;
    }
  }, [connectionState]);

  const overlayState = connectionState === 'connected' || connectionState === 'connecting'
    ? 'connected'
    : connectionState;

  return (
    <div className="flex flex-col h-svh">
      {/* Header bar */}
      <div className="h-12 bg-card border-b border-border flex items-center px-4 gap-2 z-50">
        <Link href="/dashboard" aria-label="Back to dashboard">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="size-4" />
          </Button>
        </Link>
        <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
          {environmentName}
        </span>
        <span className="size-2 rounded-full bg-green-500" />
      </div>

      {/* Tab bar */}
      <TerminalTabs
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeTab={activeTabId}
        onTabSwitch={switchTab}
        onTabClose={closeTabById}
        onTabRename={renameTab}
        onNewTab={addTab}
        maxTabs={MAX_TABS}
      />

      {/* Terminal container */}
      <div className="flex-1 relative overflow-hidden bg-background p-0">
        {tabs.map((tab) => (
          <TerminalInstance
            key={tab.id}
            visible={tab.id === activeTabId}
            onData={(data) => handleData(tab.id, data)}
            onResize={(cols, rows) => handleResize(tab.id, cols, rows)}
            terminalRef={tab.terminalRef as React.MutableRefObject<Terminal | null>}
          />
        ))}
        <ReconnectOverlay state={overlayState} onRetry={handleRetry} />
      </div>
    </div>
  );
}
