// Mirrors the database rules in supabase/migrations/*_admin_foundation.sql.
// The UI uses this only to hide or disable controls; the database enforces it.

export const ROLES = ['viewer', 'editor', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { viewer: 'Viewer', editor: 'Editor', admin: 'Admin', owner: 'Owner' };

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: 'Can see everything in the admin except signed talent releases. Can’t change anything.',
  editor: 'Can write and edit drafts, upload media and triage form submissions. Can’t publish.',
  admin: 'Can publish, unpublish, archive and delete, change site settings, read talent releases and export data.',
  owner: 'Everything an admin can do, plus inviting team members and changing their roles.',
};

export type Permission =
  | 'view'
  | 'edit_content'
  | 'upload_media'
  | 'triage'
  | 'publish'
  | 'delete'
  | 'manage_settings'
  | 'manage_pledges'
  | 'view_releases'
  | 'export'
  | 'view_audit'
  | 'manage_team';

const MIN_ROLE: Record<Permission, Role> = {
  view: 'viewer',
  edit_content: 'editor',
  upload_media: 'editor',
  triage: 'editor',
  publish: 'admin',
  delete: 'admin',
  manage_settings: 'admin',
  manage_pledges: 'admin',
  view_releases: 'admin',
  export: 'admin',
  view_audit: 'admin',
  manage_team: 'owner',
};

export function rank(role: Role | null | undefined): number {
  return role ? ROLES.indexOf(role) + 1 : 0;
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return rank(role) >= rank(MIN_ROLE[permission]);
}

export function minimumRole(permission: Permission): Role {
  return MIN_ROLE[permission];
}
