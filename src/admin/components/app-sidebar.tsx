import { ChevronRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/admin/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/admin/components/ui/sidebar';
import { useAuth } from '@/admin/lib/auth';
import { useDashboard } from '@/admin/lib/data';
import { isActivePath, isParent, navFor, type BadgeKey, type NavParent } from '@/admin/nav';
import { BrandLockup, BrandMark } from './brand';

const BADGE_RANGE = { from: new Date(0), to: new Date(8.64e15) };

function useBadges(): Partial<Record<BadgeKey, number>> {
  const q = useDashboard(BADGE_RANGE.from, BADGE_RANGE.to);
  return q.data?.pending ?? {};
}

function Badge({ value }: Readonly<{ value: number | undefined }>) {
  // Zero is meaningful (“nothing waiting”) but not worth a badge; unknown shows nothing.
  if (!value) return null;
  return (
    <SidebarMenuBadge className="rounded-full bg-brand-red/10 px-1.5 text-[11px] font-semibold text-brand-red dark:bg-brand-red/25 dark:text-[#ffb3be]">
      {value > 99 ? '99+' : value}
      <span className="sr-only"> waiting</span>
    </SidebarMenuBadge>
  );
}

function ParentItem({ entry, pathname, badges }: Readonly<{ entry: NavParent; pathname: string; badges: Partial<Record<BadgeKey, number>> }>) {
  const containsActive = entry.children.some((c) => isActivePath(pathname, c));
  const [open, setOpen] = useState(containsActive);
  const [seenPath, setSeenPath] = useState(pathname);
  const { state, isMobile } = useSidebar();
  const total = entry.children.reduce((n, c) => n + (c.badge ? (badges[c.badge] ?? 0) : 0), 0);
  // Expand automatically when navigation lands inside this group (the person can still collapse it).
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (containsActive) setOpen(true);
  }

  if (state === 'collapsed' && !isMobile) {
    // Collapsed rail: show each child as its own icon with a tooltip.
    return (
      <>
        {entry.children.map((c) => (
          <SidebarMenuItem key={c.to}>
            <SidebarMenuButton asChild isActive={isActivePath(pathname, c)} tooltip={c.title}>
              <Link to={c.to} aria-current={isActivePath(pathname, c) ? 'page' : undefined}>
                <c.icon />
                <span>{c.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={entry.title} aria-expanded={open}>
            <entry.icon />
            <span>{entry.title}</span>
            {!open && total > 0 && <span className="ml-auto rounded-full bg-brand-red/10 px-1.5 text-[11px] font-semibold text-brand-red">{total}</span>}
            <ChevronRight className={`ml-auto transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {entry.children.map((c) => {
              const active = isActivePath(pathname, c);
              const n = c.badge ? badges[c.badge] : undefined;
              return (
                <SidebarMenuSubItem key={c.to}>
                  <SidebarMenuSubButton asChild isActive={active}>
                    <Link to={c.to} aria-current={active ? 'page' : undefined}>
                      <span className="truncate">{c.title}</span>
                      {n ? (
                        <span className="ml-auto rounded-full bg-brand-red/10 px-1.5 text-[11px] font-semibold text-brand-red dark:text-[#ffb3be]">
                          {n}
                          <span className="sr-only"> waiting</span>
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { member } = useAuth();
  const { pathname } = useLocation();
  const badges = useBadges();
  const groups = navFor(member?.role);

  return (
    <Sidebar collapsible="icon" aria-label="Admin navigation">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
        <Link to="/admin" className="flex min-w-0 items-center rounded-md outline-offset-2 group-data-[collapsible=icon]:justify-center" aria-label="James Reports admin — overview">
          <span className="group-data-[collapsible=icon]:hidden">
            <BrandLockup />
          </span>
          <span className="hidden group-data-[collapsible=icon]:block">
            <BrandMark />
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-1.5">
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">{g.label}</SidebarGroupLabel>
            <SidebarMenu>
              {g.items.map((e) =>
                isParent(e) ? (
                  <ParentItem key={e.title} entry={e} pathname={pathname} badges={badges} />
                ) : (
                  <SidebarMenuItem key={e.to}>
                    <SidebarMenuButton asChild isActive={isActivePath(pathname, e)} tooltip={e.title}>
                      <Link to={e.to} aria-current={isActivePath(pathname, e) ? 'page' : undefined}>
                        <e.icon />
                        <span className="truncate">{e.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {e.badge && <Badge value={badges[e.badge]} />}
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View website">
              <a href="/" target="_blank" rel="noopener">
                <ExternalLink />
                <span>View website</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
