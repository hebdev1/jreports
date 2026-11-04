import { ExternalLink, LogOut, Monitor, Moon, Search, Sun, UserRound } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useMatches } from 'react-router';
import { Avatar, AvatarFallback } from '@/admin/components/ui/avatar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/admin/components/ui/breadcrumb';
import { Button } from '@/admin/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/admin/components/ui/dropdown-menu';
import { Separator } from '@/admin/components/ui/separator';
import { SidebarTrigger } from '@/admin/components/ui/sidebar';
import { useAuth } from '@/admin/lib/auth';
import { initials } from '@/admin/lib/format';
import { ROLE_LABELS } from '@/admin/lib/permissions';
import { useTheme, type Theme } from '@/admin/lib/theme';
import { useCrumbLeaf } from './common';

export interface CrumbHandle {
  crumb?: string;
}

function Crumbs() {
  const matches = useMatches();
  const leaf = useCrumbLeaf();
  const crumbs = matches
    .filter((m) => (m.handle as CrumbHandle | undefined)?.crumb)
    .map((m) => ({ label: (m.handle as CrumbHandle).crumb!, to: m.pathname }));
  if (leaf) crumbs.push({ label: leaf, to: '' });
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.to}-${c.label}`}>
              {i > 0 && <BreadcrumbSeparator className={i < crumbs.length - 1 ? 'hidden sm:block' : undefined} />}
              <BreadcrumbItem className={!last ? 'hidden sm:inline-flex' : 'min-w-0'}>
                {last ? (
                  <BreadcrumbPage className="truncate font-medium">{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

const THEME_ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function SiteHeader({ onSearch }: Readonly<{ onSearch: () => void }>) {
  const { member, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_ICON[theme];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
      <SidebarTrigger className="-ml-1" aria-label="Show or hide navigation" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
      <Crumbs />
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onSearch} className="h-8 gap-2 px-2.5 text-muted-foreground sm:w-56 sm:justify-start" aria-label="Search (Ctrl+K)">
          <Search className="size-4" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 font-sans text-[10px] font-medium sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </Button>
        <Button variant="ghost" size="sm" asChild className="hidden h-8 gap-1.5 md:inline-flex">
          <a href="/" target="_blank" rel="noopener">
            View website <ExternalLink className="size-3.5" />
          </a>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Theme: ${theme}`}>
              <ThemeIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-1.5" aria-label="Account menu">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">{initials(member?.display_name || member?.email || '?')}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{member?.display_name || member?.email}</p>
              <p className="truncate text-xs text-muted-foreground">{member?.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">Role: {member ? ROLE_LABELS[member.role] : '—'}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/account">
                <UserRound /> Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="md:hidden">
              <a href="/" target="_blank" rel="noopener">
                <ExternalLink /> View website
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
