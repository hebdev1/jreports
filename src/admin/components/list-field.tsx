import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/admin/components/ui/button';

/**
 * An ordered list editor: rows with move up / move down / remove and an add
 * button. Works with react-hook-form's useFieldArray or plain state.
 */
export function ListField<T>({
  label,
  description,
  items,
  getKey,
  renderItem,
  onAdd,
  onRemove,
  onMove,
  max,
  addLabel = 'Add',
  disabled,
  error,
}: Readonly<{
  label: string;
  description?: ReactNode;
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  max: number;
  addLabel?: string;
  disabled?: boolean;
  error?: string;
}>) {
  return (
    <div className="grid gap-2" role="group" aria-label={label}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {items.length}/{max}
        </span>
      </div>
      {description && <p className="-mt-1 text-[12px] text-muted-foreground">{description}</p>}
      {items.length === 0 && <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[13px] text-muted-foreground">Nothing here yet.</p>}
      <ol className="grid gap-2">
        {items.map((item, i) => (
          <li key={getKey(item, i)} className="flex items-start gap-2 rounded-lg border bg-background/50 p-2.5">
            <span className="mt-2 w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">{renderItem(item, i)}</div>
            {!disabled && (
              <div className="flex shrink-0 items-center">
                <Button type="button" size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={`Move item ${i + 1} up`}>
                  <ArrowUp />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" disabled={i === items.length - 1} onClick={() => onMove(i, i + 1)} aria-label={`Move item ${i + 1} down`}>
                  <ArrowDown />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => onRemove(i)} aria-label={`Remove item ${i + 1}`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {error && <p className="text-[12px] font-medium text-destructive">{error}</p>}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={items.length >= max} onClick={onAdd}>
          <Plus aria-hidden="true" /> {addLabel}
        </Button>
      )}
    </div>
  );
}
