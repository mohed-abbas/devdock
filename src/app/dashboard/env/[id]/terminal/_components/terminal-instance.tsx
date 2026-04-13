'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  visible: boolean;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  terminalRef: React.MutableRefObject<Terminal | null>;
}

const XTERM_THEME = {
  background: '#1b1b1b',
  foreground: '#e5e5e5',
  cursor: '#e5e5e5',
  cursorAccent: '#1b1b1b',
  selectionBackground: 'rgba(255, 255, 255, 0.15)',
  black: '#1b1b1b',
  red: '#ff5f56',
  green: '#5af78e',
  yellow: '#f3f99d',
  blue: '#57c7ff',
  magenta: '#ff6ac1',
  cyan: '#9aedfe',
  white: '#e5e5e5',
  brightBlack: '#686868',
  brightRed: '#ff5f56',
  brightGreen: '#5af78e',
  brightYellow: '#f3f99d',
  brightBlue: '#57c7ff',
  brightMagenta: '#ff6ac1',
  brightCyan: '#9aedfe',
  brightWhite: '#f1f1f0',
};

export function TerminalInstance({ visible, onData, onResize, terminalRef }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const mountedRef = useRef(false);

  // Stable callbacks via refs to avoid effect re-runs
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  // Mount terminal once
  useEffect(() => {
    if (mountedRef.current || !containerRef.current) return;
    mountedRef.current = true;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'var(--font-geist-mono), monospace',
      lineHeight: 1.2,
      scrollback: 5000,
      theme: XTERM_THEME,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const clipboardAddon = new ClipboardAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(clipboardAddon);

    terminal.open(containerRef.current);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Delay fit() to next animation frame so the renderer is fully initialized
    // and the DOM layout (flex heights) has been computed. Calling fit()
    // synchronously after open() causes "this._renderer.value is undefined"
    // because the renderer hasn't been assigned yet.
    const rafId = requestAnimationFrame(() => {
      if (fitAddonRef.current && terminal.element) {
        fitAddonRef.current.fit();
      }
    });

    terminal.onData((data) => {
      onDataRef.current(data);
    });

    // Debounced resize via ResizeObserver (Pitfall 3: 150ms debounce)
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (fitAddonRef.current && terminal.element) {
          fitAddonRef.current.fit();
          onResizeRef.current(terminal.cols, terminal.rows);
        }
      }, 150);
    });

    observer.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle visibility changes: fit and focus when becoming visible
  useEffect(() => {
    if (visible && fitAddonRef.current && terminalRef.current) {
      // Small delay to let the DOM update the display property
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        terminalRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={visible ? 'block h-full' : 'hidden'}
    />
  );
}
