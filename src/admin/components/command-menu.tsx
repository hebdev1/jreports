import { useQuery } from '@tanstack/react-query';
import { Clapperboard, Handshake, Newspaper, Plus, Upload } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/admin/components/ui/command';
import { useAuth } from '@/admin/lib/auth';
import { pgrstLike } from '@/admin/lib/data';
import { sb } from '@/admin/lib/supabase';
import { flatNav } from '@/admin/nav';

interface Hit {
  kind: 'episode' | 'report' | 'sponsor';
  id: string;
  title: string;
  status: string;
}

async function searchRecords(term: string): Promise<Hit[]> {
  const like = pgrstLike(term);
  const [eps, reps, spons] = await Promise.all([
    sb.from('episodes').select('id, title, status').or(`title.ilike.${like},id.ilike.${like},guest.ilike.${like}`).limit(5),
    sb.from('reports').select('id, title, status').ilike('title', like).limit(5),
    sb.from('sponsors').select('id, name, status').ilike('name', like).limit(3),
  ]);
  return [
    ...(eps.data ?? []).map((r) => ({ kind: 'episode' as const, id: r.id as string, title: r.title as string, status: r.status as string })),
    ...(reps.data ?? []).map((r) => ({ kind: 'report' as const, id: r.id as string, title: r.title as string, status: r.status as string })),
    ...(spons.data ?? []).map((r) => ({ kind: 'sponsor' as const, id: r.id as string, title: r.name as string, status: r.status as string })),
  ];
}

const HIT_PATH = { episode: '/admin/episodes/', report: '/admin/reports/', sponsor: '/admin/sponsors/' } as const;
const HIT_ICON = { episode: Clapperboard, report: Newspaper, sponsor: Handshake } as const;

/** Cmd/Ctrl+K: jump to any page you may open, create content, or find a record. */
export function CommandMenu({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (o: boolean) => void }>) {
  const navigate = useNavigate();
  const { member, can } = useAuth();
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const hits = useQuery({ queryKey: ['command-search', term], enabled: open && term.length >= 2, queryFn: () => searchRecords(term), staleTime: 10_000 });

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const actions = [
    can('edit_content') && { label: 'New episode', to: '/admin/episodes/new', icon: Plus },
    can('edit_content') && { label: 'New report', to: '/admin/reports/new', icon: Plus },
    can('edit_content') && { label: 'New archive interview', to: '/admin/archive/new', icon: Plus },
    can('edit_content') && { label: 'New sponsor', to: '/admin/sponsors/new', icon: Plus },
    can('upload_media') && { label: 'Upload images', to: '/admin/media?upload=1', icon: Upload },
  ].filter(Boolean) as Array<{ label: string; to: string; icon: typeof Plus }>;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search the admin" description="Go to a page, create content or find an episode, report or sponsor.">
      <CommandInput placeholder="Search pages, episodes, reports, sponsors…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>{hits.isFetching ? 'Searching…' : 'No results.'}</CommandEmpty>
        {(hits.data?.length ?? 0) > 0 && (
          <CommandGroup heading="Records">
            {hits.data!.map((h) => {
              const Icon = HIT_ICON[h.kind];
              return (
                <CommandItem key={h.kind + h.id} value={`${h.kind} ${h.title} ${h.id}`} onSelect={() => go(HIT_PATH[h.kind] + encodeURIComponent(h.id))}>
                  <Icon />
                  <span className="truncate">{h.title}</span>
                  <span className="ml-auto text-xs capitalize text-muted-foreground">
                    {h.kind} · {h.status}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        <CommandGroup heading="Go to">
          {flatNav(member?.role).map((n) => (
            <CommandItem key={n.to} value={`${n.title} ${(n.keywords ?? []).join(' ')}`} onSelect={() => go(n.to)}>
              <n.icon />
              {n.title}
            </CommandItem>
          ))}
          <CommandItem value="account profile password theme" onSelect={() => go('/admin/account')}>
            Account
          </CommandItem>
        </CommandGroup>
        {actions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              {actions.map((a) => (
                <CommandItem key={a.to} value={a.label} onSelect={() => go(a.to)}>
                  <a.icon />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
