import { useId, type ReactNode } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Switch } from '@/admin/components/ui/switch';
import { Textarea } from '@/admin/components/ui/textarea';
import { cn } from '@/admin/lib/utils';

interface FieldShellProps {
  label: string;
  description?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  counter?: { value: number; max: number };
}

/** Label, help text, error and character count around any control, wired for screen readers. */
export function Field({ label, description, error, required, className, children, counter }: Readonly<FieldShellProps>) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, descId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[13px] font-medium">
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </Label>
        {counter && (
          <span className={cn('text-[11px] tabular-nums text-muted-foreground', counter.value > counter.max && 'text-destructive')} aria-hidden="true">
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {description && !error && (
        <p id={descId} className="text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} className="text-[12px] font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type Common<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  max,
  type = 'text',
  placeholder,
  inputMode,
}: Readonly<Common<T> & { max?: number; type?: string; placeholder?: string; inputMode?: 'numeric' | 'url' | 'email' | 'text' }>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          description={description}
          required={required}
          error={fieldState.error?.message}
          className={className}
          counter={max && typeof field.value === 'string' ? { value: field.value.length, max } : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        </Field>
      )}
    />
  );
}

export function TextAreaField<T extends FieldValues>({ control, name, label, description, required, disabled, className, max, rows = 3 }: Readonly<Common<T> & { max?: number; rows?: number }>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          description={description}
          required={required}
          error={fieldState.error?.message}
          className={className}
          counter={max && typeof field.value === 'string' ? { value: field.value.length, max } : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              rows={rows}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          )}
        </Field>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  options,
  placeholder = 'Choose…',
}: Readonly<Common<T> & { options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} description={description} required={required} error={fieldState.error?.message} className={className}>
          {({ id, describedBy, invalid }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="w-full" onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({ control, name, label, description, disabled, className }: Readonly<Common<T>>) {
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn('flex items-start justify-between gap-4 rounded-lg border px-4 py-3', className)}>
          <div className="min-w-0">
            <Label htmlFor={id} className="text-[13px] font-medium">
              {label}
            </Label>
            {description && (
              <p id={`${id}-d`} className="mt-0.5 text-[12px] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} aria-describedby={description ? `${id}-d` : undefined} />
        </div>
      )}
    />
  );
}

/** Groups fields in a card-like section of an editor. */
export function FormSection({ title, description, children }: Readonly<{ title: string; description?: ReactNode; children: ReactNode }>) {
  return (
    <fieldset className="grid gap-4 rounded-xl border bg-card p-5">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}
