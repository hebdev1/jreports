import { useId, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { sx } from '../lib/sx';

export const INPUT = 'padding:14px 16px;border:1px solid #CDD4E6;border-radius:8px;background:#FFFFFF;font-size:15px;color:#0B1F5C;width:100%;outline:0;min-width:0';
export const INPUT_DARK = 'padding:14px 16px;border:1px solid rgba(247,248,252,0.22);border-radius:8px;background:rgba(247,248,252,0.06);font-size:15px;color:#FFFFFF;width:100%;outline:0;min-width:0';
export const EYEBROW = 'font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase';

/** Blue-over-red Haitian flag stripe used between sections. */
export function FlagBar({ h = 4, style }: Readonly<{ h?: number; style?: CSSProperties }>) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gridTemplateRows: `${h}px ${h}px`, ...style }}>
      <div style={{ background: '#00209F' }} />
      <div style={{ background: '#D21034' }} />
    </div>
  );
}

interface FieldBase {
  label: string;
  error?: string;
  /** Keep the label for assistive tech only (the design shows placeholders). */
  hideLabel?: boolean;
  dark?: boolean;
  /** Design label style when the label is visible. */
  labelCss?: string;
  wrapCss?: string;
  hint?: string;
}

const ERR_LIGHT = '#B00D2B';
const ERR_DARK = '#FF8A9B';

function FieldShell({ id, label, error, hideLabel, dark, labelCss, wrapCss, hint, children }: Readonly<FieldBase & { id: string; children: ReactNode }>) {
  return (
    <div style={sx(wrapCss ?? 'display:flex;flex-direction:column;gap:6px;min-width:0')}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined} style={hideLabel ? undefined : sx(labelCss ?? 'font-size:13px;font-weight:600;color:#4A5578')}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} style={{ fontSize: 12, color: dark ? '#9AA6CC' : '#6B6B6B' }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} style={{ fontSize: 13, lineHeight: 1.4, color: dark ? ERR_DARK : ERR_LIGHT }}>
          {error}
        </span>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-err` : hint ? `${id}-hint` : undefined;
}

export function Field({ label, error, hideLabel, dark, labelCss, wrapCss, hint, style, ...input }: Readonly<FieldBase & InputHTMLAttributes<HTMLInputElement>>) {
  const id = useId();
  return (
    <FieldShell {...{ id, label, error, hideLabel, dark, labelCss, wrapCss, hint }}>
      <input
        id={id}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        style={{ ...sx(dark ? INPUT_DARK : INPUT), ...style }}
        {...input}
      />
    </FieldShell>
  );
}

export function TextArea({ label, error, hideLabel, dark, labelCss, wrapCss, hint, style, ...area }: Readonly<FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  const id = useId();
  return (
    <FieldShell {...{ id, label, error, hideLabel, dark, labelCss, wrapCss, hint }}>
      <textarea
        id={id}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        style={{ ...sx((dark ? INPUT_DARK : INPUT) + ';resize:vertical;font-family:inherit;line-height:1.5'), ...style }}
        {...area}
      />
    </FieldShell>
  );
}

/** A toggle chip / tile. `look(on)` returns the design's selected colours. */
export function Chip({
  on,
  onClick,
  css,
  look,
  children,
  className = '',
}: Readonly<{ on: boolean; onClick: () => void; css: string; look: (on: boolean) => CSSProperties; children: ReactNode; className?: string }>) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`press ${className}`} style={{ ...sx(css), ...look(on), cursor: 'pointer' }}>
      {children}
    </button>
  );
}

/** Group label + error for a set of chips. */
export function ChipGroup({
  label,
  labelCss,
  wrapCss = 'display:flex;flex-direction:column;gap:10px',
  rowCss = 'display:flex;gap:8px;flex-wrap:wrap',
  error,
  dark,
  children,
}: Readonly<{ label: string; labelCss: string; wrapCss?: string; rowCss?: string; error?: string; dark?: boolean; children: ReactNode }>) {
  const id = useId();
  return (
    <div style={sx(wrapCss)}>
      <span id={id} style={sx(labelCss)}>
        {label}
      </span>
      <div role="group" aria-labelledby={id} aria-describedby={error ? `${id}-err` : undefined} style={sx(rowCss)}>
        {children}
      </div>
      {error && (
        <span id={`${id}-err`} style={{ fontSize: 13, color: dark ? ERR_DARK : ERR_LIGHT }}>
          {error}
        </span>
      )}
    </div>
  );
}

/** Invisible field bots fill in; the database rejects submissions that do. */
export function Honeypot({ value, onChange }: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

/** Submission error banner, announced to screen readers. */
export function FormAlert({ message, dark }: Readonly<{ message: string | null; dark?: boolean }>) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: 14,
        lineHeight: 1.5,
        background: dark ? 'rgba(210,16,52,0.16)' : '#FDECEF',
        color: dark ? '#FFD1D8' : '#5A0A1A',
        border: `1px solid ${dark ? 'rgba(255,138,155,0.5)' : '#F5C9D1'}`,
      }}
    >
      {message}
    </div>
  );
}

export function Spinner({ label }: Readonly<{ label?: string }>) {
  return (
    <>
      <span className="spinner" aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

/** Loading placeholder blocks while content arrives. */
export function Skeleton({ count, css }: Readonly<{ count: number; css: string }>) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={sx(css)} aria-hidden="true" />
      ))}
    </>
  );
}

/** Inline content-load failure with a retry button. */
export function LoadError({ message, onRetry, dark }: Readonly<{ message: string; onRetry: () => void; dark?: boolean }>) {
  return (
    <div role="alert" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '18px 20px', borderRadius: 12, border: `1px solid ${dark ? 'rgba(247,248,252,0.2)' : '#E4E8F2'}`, background: dark ? 'rgba(247,248,252,0.05)' : '#FFFFFF', color: dark ? '#C3CCE6' : '#4A5578', fontSize: 15, gridColumn: '1 / -1' }}>
      <span style={{ flex: 1, minWidth: 200 }}>{message}</span>
      <button type="button" onClick={onRetry} className="press" style={{ background: dark ? '#FFFFFF' : '#0B1F5C', color: dark ? '#081230' : '#FFFFFF', border: 0, borderRadius: 999, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  );
}

/** After a failed submit, move focus to the first field flagged invalid (once React has rendered the errors). */
export function focusFirstError(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus());
}
