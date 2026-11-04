import { CircleAlert, Lock, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/admin/components/ui/alert-dialog';
import { Badge } from '@/admin/components/ui/badge';
import { Button } from '@/admin/components/ui/button';
import { Skeleton } from '@/admin/components/ui/skeleton';
import { minimumRole, ROLE_LABELS, type Permission } from '@/admin/lib/permissions';
import { cn } from '@/admin/lib/utils';

// ------------------------------------------------------------------- layout

export function Page({ children, width = 'default' }: Readonly<{ children: ReactNode; width?: 'default' | 'narrow' | 'wide' }>) {
  const max = width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-7xl' : 'max-w-6xl';
  return <div className={cn('mx-auto w-full px-4 pb-16 pt-6 sm:px-6 lg:px-8', max)}>{children}</div>;
}

export function PageHeader({ title, description, actions, meta }: Readonly<{ title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }>) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: Readonly<{ title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }>) {
  return (
    <section className={cn('rounded-xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(11,31,92,0.04)]', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------- states

export function LoadingBlock({ rows = 4, className }: Readonly<{ rows?: number; className?: string }>) {
  return (
    <div role="status" aria-label="Loading" className={cn('space-y-3', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: Readonly<{ icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }>) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact }: Readonly<{ error: unknown; onRetry?: () => void; compact?: boolean }>) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-xl border border-destructive/30 bg-danger-soft text-sm', compact ? 'p-3' : 'p-4')}>
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Forbidden({ permission }: Readonly<{ permission: Permission }>) {
  return (
    <Page width="narrow">
      <EmptyState
        icon={Lock}
        title="You don’t have access to this page"
        description={`This area needs the ${ROLE_LABELS[minimumRole(permission)]} role or higher. Ask a team owner if you need it.`}
      />
    </Page>
  );
}

// ------------------------------------------------------------------- status

const STATUS_STYLES: Record<string, string> = {
  published: 'border-transparent bg-success-soft text-success',
  draft: 'border-transparent bg-warning-soft text-warning',
  archived: 'border-transparent bg-muted text-muted-foreground',
  new: 'border-transparent bg-info-soft text-info',
  in_review: 'border-transparent bg-warning-soft text-warning',
  closed: 'border-transparent bg-muted text-muted-foreground',
  accepted: 'border-transparent bg-success-soft text-success',
  declined: 'border-transparent bg-muted text-muted-foreground',
  pending_payment: 'border-transparent bg-warning-soft text-warning',
  paid: 'border-transparent bg-success-soft text-success',
  cancelled: 'border-transparent bg-muted text-muted-foreground',
  valid: 'border-transparent bg-success-soft text-success',
  void: 'border-transparent bg-danger-soft text-destructive',
  subscribed: 'border-transparent bg-success-soft text-success',
  unsubscribed: 'border-transparent bg-muted text-muted-foreground',
  changes: 'border-transparent bg-info-soft text-info',
};

export const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
  new: 'New',
  in_review: 'In review',
  closed: 'Closed',
  accepted: 'Accepted',
  declined: 'Declined',
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
  valid: 'Valid',
  void: 'Void',
  subscribed: 'Subscribed',
  unsubscribed: 'Unsubscribed',
  changes: 'Unpublished changes',
};

export function StatusBadge({ status, className }: Readonly<{ status: string; className?: string }>) {
  return (
    <Badge variant="outline" className={cn('rounded-full px-2 py-0 text-[11px] font-semibold', STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ------------------------------------------------------------------ confirm

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});
  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );
  const close = (v: boolean) => {
    resolver.current(v);
    setOpts(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={opts !== null} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts?.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            >
              {opts?.confirmLabel ?? 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

// -------------------------------------------------------- unsaved changes

/** Warns before leaving a page with unsaved edits (in-app navigation and tab close). */
export function useUnsavedGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  const confirm = useConfirm();

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: 'Discard unsaved changes?',
      description: 'You have edits on this page that haven’t been saved. If you leave now they’ll be lost.',
      confirmLabel: 'Discard and leave',
      destructive: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);
}

// --------------------------------------------------------------- crumbs

const CrumbContext = createContext<{ leaf: string | null; setLeaf: (s: string | null) => void }>({ leaf: null, setLeaf: () => {} });

export function CrumbProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [leaf, setLeaf] = useState<string | null>(null);
  return <CrumbContext.Provider value={{ leaf, setLeaf }}>{children}</CrumbContext.Provider>;
}

export const useCrumbLeaf = () => useContext(CrumbContext).leaf;

/** Sets the last breadcrumb (e.g. a record's title) and the browser tab title. */
export function usePageTitle(title: string | null | undefined, asCrumb = false) {
  const { setLeaf } = useContext(CrumbContext);
  useEffect(() => {
    document.title = title ? `${title} · Admin · James Reports` : 'Admin · James Reports';
    if (asCrumb) setLeaf(title ?? null);
    return () => {
      if (asCrumb) setLeaf(null);
    };
  }, [title, asCrumb, setLeaf]);
}
