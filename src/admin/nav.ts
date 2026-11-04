import {
  Archive,
  CalendarCheck,
  Clapperboard,
  Crown,
  FileSignature,
  HandHeart,
  Handshake,
  History,
  House,
  Images,
  Inbox,
  LayoutDashboard,
  Mail,
  Mic,
  Newspaper,
  Palette,
  PanelTop,
  Tv,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Dashboard } from './lib/data';
import { can, type Permission, type Role } from './lib/permissions';

export type BadgeKey = keyof Dashboard['pending'];

export interface NavLeaf {
  title: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
  badge?: BadgeKey;
  keywords?: string[];
  /** Match only this exact path (used for the Overview). */
  end?: boolean;
}

export interface NavParent {
  title: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

export type NavEntry = NavLeaf | NavParent;

export interface NavGroup {
  label: string;
  items: NavEntry[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ title: 'Overview', to: '/admin', icon: LayoutDashboard, permission: 'view', end: true, keywords: ['dashboard', 'home'] }],
  },
  {
    label: 'Content',
    items: [
      { title: 'Episodes', to: '/admin/episodes', icon: Clapperboard, permission: 'view', keywords: ['podcast', 'interviews', 'audio', 'video'] },
      { title: 'Reports', to: '/admin/reports', icon: Newspaper, permission: 'view', keywords: ['articles', 'written'] },
      { title: 'Archive', to: '/admin/archive', icon: Archive, permission: 'view', keywords: ['interviews', 'the talk'] },
      { title: 'Sponsors', to: '/admin/sponsors', icon: Handshake, permission: 'view', keywords: ['partners', 'fowennurses', 'ads'] },
      { title: 'Media library', to: '/admin/media', icon: Images, permission: 'view', keywords: ['images', 'photos', 'uploads'] },
    ],
  },
  {
    label: 'Inbox',
    items: [
      {
        title: 'Submissions',
        icon: Inbox,
        children: [
          { title: 'Booking & ads', to: '/admin/inbox/bookings', icon: CalendarCheck, permission: 'view', badge: 'booking_new', keywords: ['requests', 'events', 'advertising'] },
          { title: 'Guest requests', to: '/admin/inbox/guests', icon: Mic, permission: 'view', badge: 'guest_new', keywords: ['pitches'] },
          { title: 'Talent releases', to: '/admin/inbox/releases', icon: FileSignature, permission: 'view_releases', keywords: ['signatures', 'legal'] },
          { title: 'Subscribers', to: '/admin/inbox/subscribers', icon: Mail, permission: 'view', keywords: ['newsletter', 'briefing', 'emails'] },
        ],
      },
    ],
  },
  {
    label: 'Supporters',
    items: [
      { title: 'VIP Club', to: '/admin/vip', icon: Crown, permission: 'view', badge: 'vip_unpaid', keywords: ['members', 'membership', 'pledges', 'subscription'] },
      { title: 'Donations', to: '/admin/donations', icon: HandHeart, permission: 'view', badge: 'donations_unpaid', keywords: ['donate', 'gifts', 'donors', 'pledges', 'payments', 'fundraising'] },
    ],
  },
  {
    label: 'Site',
    items: [
      { title: 'Homepage', to: '/admin/site/home', icon: House, permission: 'view', keywords: ['sections', 'timeline', 'fundraising', 'story', 'appearances', 'clients'] },
      { title: 'Header & footer', to: '/admin/site/header', icon: PanelTop, permission: 'view', keywords: ['navigation', 'menu', 'ticker', 'announcement', 'social', 'footer'] },
      { title: 'Watch & podcast', to: '/admin/site/watch', icon: Tv, permission: 'view', keywords: ['tv', 'channels', 'playlists', 'youtube'] },
      { title: 'About page', to: '/admin/site/about', icon: UserRound, permission: 'view', keywords: ['bio', 'biography'] },
      { title: 'Brand & SEO', to: '/admin/site/brand', icon: Palette, permission: 'view', keywords: ['name', 'seo', 'contact', 'images', 'logo'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { title: 'Team', to: '/admin/team', icon: Users, permission: 'view', keywords: ['users', 'roles', 'invite', 'access'] },
      { title: 'Audit log', to: '/admin/audit', icon: History, permission: 'view_audit', keywords: ['history', 'activity', 'changes'] },
    ],
  },
];

export const isParent = (e: NavEntry): e is NavParent => 'children' in e;

/** The navigation the given role may see (parents without visible children disappear). */
export function navFor(role: Role | null | undefined): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items
      .map((e) => (isParent(e) ? { ...e, children: e.children.filter((c) => can(role, c.permission)) } : e))
      .filter((e) => (isParent(e) ? e.children.length > 0 : can(role, e.permission))),
  })).filter((g) => g.items.length > 0);
}

export function flatNav(role: Role | null | undefined): NavLeaf[] {
  return navFor(role).flatMap((g) => g.items.flatMap((e) => (isParent(e) ? e.children : [e])));
}

export function isActivePath(pathname: string, leaf: NavLeaf): boolean {
  if (leaf.end) return pathname === leaf.to || pathname === `${leaf.to}/`;
  return pathname === leaf.to || pathname.startsWith(`${leaf.to}/`);
}
