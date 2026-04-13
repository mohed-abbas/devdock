'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TerminalTabsProps {
  tabs: { id: number; label: string }[];
  activeTab: number;
  onTabSwitch: (tabId: number) => void;
  onTabClose: (tabId: number) => void;
  onTabRename: (tabId: number, newLabel: string) => void;
  onNewTab: () => void;
  maxTabs: number;
}

export function TerminalTabs({
  tabs,
  activeTab,
  onTabSwitch,
  onTabClose,
  onTabRename,
  onNewTab,
  maxTabs,
}: TerminalTabsProps) {
  const isMaxed = tabs.length >= maxTabs;
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitRename = (tabId: number) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tabs.find((t) => t.id === tabId)?.label) {
      onTabRename(tabId, trimmed);
    }
    setEditingId(null);
  };

  return (
    <TooltipProvider delay={300}>
      <div
        className="h-8 bg-card border-b border-border flex items-center px-2"
        role="tablist"
        aria-label="Terminal tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`terminal-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`group/tab inline-flex items-center px-4 gap-1 h-full cursor-pointer text-sm select-none ${
                isActive
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onTabSwitch(tab.id)}
              onDoubleClick={() => {
                setEditingId(tab.id);
                setEditValue(tab.label);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTabSwitch(tab.id);
                }
              }}
            >
              {editingId === tab.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(tab.id);
                    if (e.key === 'Escape') setEditingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-b border-primary text-foreground text-sm w-[80px] outline-none"
                  maxLength={20}
                />
              ) : (
                <span className="truncate max-w-[80px]">{tab.label}</span>
              )}
              <Tooltip>
                <TooltipTrigger
                  className={`size-3 text-muted-foreground hover:text-destructive ${
                    isActive ? 'visible' : 'invisible group-hover/tab:visible'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  aria-label={`Close ${tab.label}`}
                >
                  <X className="size-3" />
                </TooltipTrigger>
                <TooltipContent>Close terminal</TooltipContent>
              </Tooltip>
            </div>
          );
        })}

        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                size="sm"
                onClick={onNewTab}
                disabled={isMaxed}
                aria-label={isMaxed ? 'Maximum 5 terminals' : 'New terminal'}
                className="ml-1"
              >
                <Plus className="size-4" />
              </Button>
            )}
          />
          <TooltipContent>
            {isMaxed ? 'Maximum 5 terminals' : 'New terminal'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
