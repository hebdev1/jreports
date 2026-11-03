import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { subscribeNewsletter } from '../lib/api';
import { chip, YOUTUBE_CHANNEL } from '../lib/theme';
import { sx } from '../lib/sx';
import { LANGUAGES, type Language } from '../lib/types';
import { useSubmit } from '../lib/useSubmit';
import { hasErrors, validateNewsletter, type Errors, type NewsletterInput } from '../lib/validation';
import { Chip, ChipGroup, Field, FormAlert, Honeypot, Spinner, EYEBROW } from './ui';

const SubscribeContext = createContext<() => void>(() => {});

export const useOpenSubscribe = () => useContext(SubscribeContext);

export function SubscribeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return (
    <SubscribeContext.Provider value={show}>
      {children}
      <SubscribeDialog open={open} onClose={() => setOpen(false)} />
    </SubscribeContext.Provider>
  );
}

const ALERTS: Array<[keyof NewsletterInput['alerts'], string]> = [
  ['premiere', 'New episode premieres'],
  ['briefing', 'Weekly briefing'],
  ['breaking', 'Breaking news from Haiti'],
];

/** The design's "Subscribe to James Reports" modal, as an accessible <dialog>. */
export function SubscribeDialog({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<NewsletterInput>({ email: '', language: 'English', alerts: { premiere: true, briefing: true, breaking: false } });
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors<NewsletterInput>>({});
  const submit = useSubmit<void>();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      submit.reset();
      setErrors({});
      d.showModal();
      // showModal() focuses the first control (the close button); start on the email field instead.
      // (next frame, so a reset from an earlier success has re-rendered the form).
      requestAnimationFrame(() => d.querySelector<HTMLInputElement>('input[type="email"]')?.focus());
    } else if (!open && d.open) d.close();
    // Runs only when `open` flips; submit.reset is stable.
  }, [open]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateNewsletter(form);
    setErrors(errs);
    if (hasErrors(errs)) return;
    void submit.run(() => subscribeNewsletter({ ...form, website }, 'subscribe_dialog'));
  };

  return (
    <dialog
      ref={ref}
      className="sub-dialog"
      aria-labelledby="sub-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div style={sx('width:100%;max-width:520px;background:#FFFFFF;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,0.2);padding:36px;display:flex;flex-direction:column;gap:20px;max-height:calc(100vh - 40px);overflow-y:auto;color:#0B1F5C')} className="card-pad">
        {submit.done ? (
          <div role="status" style={sx('display:flex;flex-direction:column;gap:14px')}>
            <h2 id="sub-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:34px;font-weight:700")}>
              Welcome aboard.
            </h2>
            <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>
              You’ll get premiere alerts and the weekly briefing at <b style={{ color: '#0B1F5C' }}>{form.email.trim()}</b>. Subscribe on YouTube too, so you never miss a live premiere.
            </p>
            <div style={sx('display:flex;gap:10px;flex-wrap:wrap')}>
              <a href={YOUTUBE_CHANNEL} target="_blank" rel="noopener noreferrer" className="h-navy" style={sx('background:#0B1F5C;color:#F7F8FC;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600')}>
                Subscribe on YouTube
              </a>
              <button type="button" onClick={onClose} autoFocus style={sx('background:none;border:1px solid #CDD4E6;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer')}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate style={sx('display:flex;flex-direction:column;gap:20px;position:relative')}>
            <div style={sx('display:flex;justify-content:space-between;align-items:flex-start;gap:16px')}>
              <div>
                <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:8px')}>Free</div>
                <h2 id="sub-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:32px;font-weight:700;line-height:1.1")}>
                  Subscribe to James Reports
                </h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" style={sx('background:none;border:0;font-size:26px;line-height:1;color:#6B6B6B;cursor:pointer;min-width:40px;min-height:40px')}>
                ×
              </button>
            </div>
            <Field
              label="Email address"
              hideLabel
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
            />
            <ChipGroup label="Briefing language" labelCss={EYEBROW + ';color:#6B6B6B'}>
              {LANGUAGES.map((l: Language) => (
                <Chip key={l} on={form.language === l} onClick={() => setForm((f) => ({ ...f, language: l }))} css="border-radius:999px;padding:8px 14px;font-size:14px;font-weight:500" look={chip}>
                  {l}
                </Chip>
              ))}
            </ChipGroup>
            <fieldset style={sx('display:flex;flex-direction:column;gap:10px;border:0;margin:0;padding:0')}>
              <legend style={sx(EYEBROW + ';color:#6B6B6B;padding:0;margin-bottom:10px')}>Alerts</legend>
              {ALERTS.map(([k, label]) => (
                <label key={k} style={sx('display:flex;gap:10px;align-items:center;font-size:15px;color:#0B1F5C;cursor:pointer')}>
                  <input type="checkbox" checked={form.alerts[k]} onChange={() => setForm((f) => ({ ...f, alerts: { ...f.alerts, [k]: !f.alerts[k] } }))} style={sx('accent-color:#D21034;width:18px;height:18px')} />
                  {label}
                </label>
              ))}
              {errors.alerts && <span style={{ fontSize: 13, color: '#B00D2B' }}>{errors.alerts}</span>}
            </fieldset>
            <Honeypot value={website} onChange={setWebsite} />
            <FormAlert message={submit.error?.message ?? null} />
            <button type="submit" disabled={submit.submitting} className="press h-red" style={{ ...sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px;font-size:15px;font-weight:600;cursor:pointer'), opacity: submit.submitting ? 0.75 : 1 }}>
              {submit.submitting ? (
                <>
                  <Spinner /> Subscribing…
                </>
              ) : (
                'Subscribe'
              )}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
