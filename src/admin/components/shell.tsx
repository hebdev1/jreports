import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '@/admin/components/ui/button';
import { SidebarInset, SidebarProvider } from '@/admin/components/ui/sidebar';
import { useAuth } from '@/admin/lib/auth';
import type { Permission } from '@/admin/lib/permissions';
import { AppSidebar } from './app-sidebar';
import { BrandLockup } from './brand';
import { CommandMenu } from './command-menu';
import { CrumbProvider, EmptyState, ErrorState, Forbidden } from './common';
import { SiteHeader } from './site-header';

function readSidebarPreference(): boolean {
  if (typeof document === 'undefined') return true;
  const m = /(?:^|;\s*)sidebar_state=(true|false)/.exec(document.cookie);
  return m ? m[1] === 'true' : true;
}

export function FullScreenMessage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLockup />
        </div>
        {children}
      </div>
    </main>
  );
}

/** Signed-in, on-the-team gate for everything under /admin. */
export function RequireTeam({ children }: Readonly<{ children: ReactNode }>) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') {
    return (
      <FullScreenMessage>
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking your session…
        </p>
      </FullScreenMessage>
    );
  }
  if (auth.status === 'signed_out') return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  if (auth.status === 'error') {
    return (
      <FullScreenMessage>
        <ErrorState error={new Error(auth.error ?? 'We couldn’t check your access.')} onRetry={auth.reload} />
      </FullScreenMessage>
    );
  }
  if (auth.status === 'no_access') {
    return (
      <FullScreenMessage>
        <EmptyState
          icon={ShieldAlert}
          title="This account isn’t on the team"
          description={`${auth.session?.user.email ?? 'This account'} is signed in but hasn’t been given access to the James Reports admin. Ask a team owner to invite you.`}
          action={
            <Button variant="outline" onClick={() => void auth.signOut()}>
              Sign out
            </Button>
          }
        />
      </FullScreenMessage>
    );
  }
  return <>{children}</>;
}

/** Route-level permission check; the database enforces the same rule. */
export function RequirePermission({ permission, children }: Readonly<{ permission: Permission; children: ReactNode }>) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Forbidden permission={permission} />;
}

export function AdminShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [defaultOpen] = useState(readSidebarPreference);
  const { pathname } = useLocation();

  useEffect(() => {
    document.getElementById('admin-main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <RequireTeam>
      <CrumbProvider>
        <SidebarProvider defaultOpen={defaultOpen} style={{ '--sidebar-width': '16.25rem' } as CSSProperties}>
          <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
            Skip to content
          </a>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <SiteHeader onSearch={() => setCommandOpen(true)} />
            <main id="admin-main" tabIndex={-1} className="flex-1 outline-none">
              <Outlet />
            </main>
          </SidebarInset>
          <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
        </SidebarProvider>
      </CrumbProvider>
    </RequireTeam>
  );
}
