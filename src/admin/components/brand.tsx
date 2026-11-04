import { cn } from '@/admin/lib/utils';

/** The site's “JR” mark: flag-blue disc with a red base, as in the public header. */
export function BrandMark({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-8 shrink-0 place-items-center rounded-full font-display text-[13px] font-bold text-white', className)}
      style={{ background: '#00209F', boxShadow: 'inset 0 -10px 0 #D21034' }}
    >
      JR
    </span>
  );
}

/** Mark + “James Reports” wordmark (Oswald, red/blue), sized for the sidebar and sign-in screens. */
export function BrandLockup({ subtitle = 'Admin', className }: Readonly<{ subtitle?: string; className?: string }>) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="font-display text-[17px] font-bold uppercase tracking-wide">
          <span className="text-brand-red">James</span> <span className="text-brand-blue dark:text-[#9fb2ff]">Reports</span>
        </span>
        <span className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{subtitle}</span>
      </span>
    </span>
  );
}
