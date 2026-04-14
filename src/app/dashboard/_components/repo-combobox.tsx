'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check, Lock, Loader2 } from 'lucide-react';
import { useGitHubRepos, type RepoItem } from '@/hooks/use-github-repos';
import { cn } from '@/lib/utils';

interface RepoComboboxProps {
  value: string | null;
  onSelect: (repo: RepoItem | null) => void;
  disabled?: boolean;
}

export function RepoCombobox({ value, onSelect, disabled }: RepoComboboxProps) {
  const [open, setOpen] = useState(false);
  const { repos, loading, error, fetchRepos } = useGitHubRepos();

  function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      fetchRepos();
    }
  }

  function handleSelect(repo: RepoItem) {
    onSelect(repo.fullName === value ? null : repo);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between text-sm"
          />
        }
      >
        {value ? (
          <span className="truncate text-foreground">{value}</span>
        ) : (
          <span className="text-muted-foreground">Select a repository...</span>
        )}
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search repositories..." />
          <CommandList className="max-h-64">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading repositories...
              </div>
            )}
            {error && !loading && (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchRepos()}
                >
                  Retry
                </Button>
              </div>
            )}
            {!loading && !error && (
              <>
                <CommandEmpty>No repositories found.</CommandEmpty>
                <CommandGroup>
                  {repos.map((repo) => (
                    <CommandItem
                      key={repo.id}
                      value={repo.fullName}
                      onSelect={() => handleSelect(repo)}
                      data-checked={value === repo.fullName ? 'true' : undefined}
                    >
                      <span className="truncate">{repo.fullName}</span>
                      {repo.private && (
                        <Lock
                          className="size-3 text-muted-foreground"
                          aria-label="Private repository"
                        />
                      )}
                      <Check
                        className={cn(
                          'ml-auto size-4',
                          value === repo.fullName ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
