'use client';

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
  onNewTab: () => void;
  maxTabs: number;
}

export function TerminalTabs({
  tabs,
  activeTab,
  onTabSwitch,
  onTabClose,
  onNewTab,
  maxTabs,
}: TerminalTabsProps) {
  const isMaxed = tabs.length >= maxTabs;

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
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTabSwitch(tab.id);
                }
              }}
            >
              <span className="truncate max-w-[80px]">{tab.label}</span>
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
