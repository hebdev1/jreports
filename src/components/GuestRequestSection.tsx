import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitGuestRequest } from '../lib/api';
import { useConfig } from '../lib/content';
import { sx } from '../lib/sx';
import { darkChip } from '../lib/theme';
import { LANGUAGES, TOPICS } from '../lib/types';
import { useSubmit } from '../lib/useSubmit';
import { GUEST_FORMATS, hasErrors, validateGuest, type Errors, type GuestInput } from '../lib/validation';
import { MediaImg } from './Img';
import { Chip, ChipGroup, EYEBROW, Field, FormAlert, Honeypot, Spinner, TextArea, focusFirstError } from './ui';

const EMPTY: GuestInput = { fullName: '', titleOrg: '', email: '', phone: '', topic: 'Haiti', languages: ['English'], format: 'One-on-one interview', links: '', pitch: '' };

/** "Request to be a guest on James Reports" — shown at the foot of every page. */
export function GuestRequestSection() {
  const { slot } = useConfig();
  const [form, setForm] = useState<GuestInput>(EMPTY);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors<GuestInput>>({});
  const submit = useSubmit<string>();
  const doneRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof GuestInput>(k: K, v: GuestInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (submit.done) doneRef.current?.focus();
  }, [submit.done]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateGuest(form);
    setErrors(errs);
    if (hasErrors(errs)) {
      focusFirstError(e.currentTarget as HTMLFormElement);
      return;
    }
    void submit.run(() => submitGuestRequest({ ...form, website }));
  };

  const label = EYEBROW + ';color:#8E9AC0';
  return (
    <section id="guest-request" aria-labelledby="guest-title" className="on-dark no-print" style={sx('background:#050B22;color:#FFFFFF;border-top:1px solid rgba(247,248,252,0.08)')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:48px 64px;align-items:start')}>
        <div style={sx('display:flex;flex-direction:column;gap:20px')}>
          <span style={sx(EYEBROW + ';color:#FF8A9B')}>Be on the show</span>
          <h2 id="guest-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,54px);font-weight:700;letter-spacing:-0.02em;line-height:1.05;text-wrap:balance")}>
            Request to be a guest on James Reports
          </h2>
          <p style={sx("margin:0;font-family:'Lora',serif;font-size:18px;line-height:1.6;color:#C3CCE6;max-width:480px")}>
            Experts, community leaders, artists, athletes and people with a story to tell. Tell us who you are and what you’d like to talk about.
          </p>
          <div style={sx('position:relative;aspect-ratio:16/10;border-radius:12px;overflow:hidden;background:#0B1F5C;max-width:520px')}>
            <MediaImg media={slot('guestPhoto')} fallback="james-blue-interview.png" alt="James Pierre listening during a sit-down interview" sizes="(max-width: 900px) 100vw, 520px" />
          </div>
        </div>
        <div className="card-pad" style={sx('background:#081230;border:1px solid rgba(247,248,252,0.1);border-radius:20px;padding:32px')}>
          {submit.done ? (
            <div role="status" style={sx('display:flex;flex-direction:column;gap:14px')}>
              <span style={sx(EYEBROW + ';color:#FF8A9B')}>Request received</span>
              <h3 ref={doneRef} tabIndex={-1} style={sx("margin:0;font-family:'Playfair Display',serif;font-size:32px;font-weight:700;line-height:1.15;outline:none")}>
                Thank you. The team will review your pitch.
              </h3>
              <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#C3CCE6')}>
                Reference <b style={{ color: '#FFFFFF' }}>{submit.result}</b>. If it’s a fit, a producer will reach out to schedule a pre-interview.
              </p>
              <button
                type="button"
                onClick={() => {
                  setForm(EMPTY);
                  submit.reset();
                }}
                style={sx('align-self:flex-start;background:none;border:0;border-bottom:1px solid #FFFFFF;padding:4px 0;font-size:14px;font-weight:600;color:#FFFFFF;cursor:pointer')}
              >
                Send another request
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate aria-label="Guest request" style={sx('display:flex;flex-direction:column;gap:20px;position:relative')}>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
                <Field dark hideLabel label="Full name" placeholder="Full name" autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
                <Field dark hideLabel label="Title or organization" placeholder="Title or organization" autoComplete="organization" value={form.titleOrg} onChange={(e) => set('titleOrg', e.target.value)} error={errors.titleOrg} />
                <Field dark hideLabel label="Email" type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
                <Field dark hideLabel label="Phone (optional)" type="tel" placeholder="Phone" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
              </div>
              <ChipGroup label="Topic" labelCss={label} dark error={errors.topic}>
                {TOPICS.map((t) => (
                  <Chip key={t} on={form.topic === t} onClick={() => set('topic', t)} css="border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500" look={darkChip}>
                    {t}
                  </Chip>
                ))}
              </ChipGroup>
              <ChipGroup label="Interview language" labelCss={label} dark error={errors.languages}>
                {LANGUAGES.map((l) => (
                  <Chip
                    key={l}
                    on={form.languages.includes(l)}
                    onClick={() => setForm((f) => ({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l] }))}
                    css="border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500"
                    look={darkChip}
                  >
                    {l}
                  </Chip>
                ))}
              </ChipGroup>
              <ChipGroup label="Format" labelCss={label} dark rowCss="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
                {GUEST_FORMATS.map((f) => (
                  <Chip key={f} on={form.format === f} onClick={() => set('format', f)} css="padding:12px;border-radius:8px;font-size:14px;font-weight:600" look={darkChip}>
                    {f}
                  </Chip>
                ))}
              </ChipGroup>
              <Field dark hideLabel label="Website or social links (optional)" placeholder="Website or social links" value={form.links} onChange={(e) => set('links', e.target.value)} error={errors.links} />
              <TextArea dark hideLabel label="Your story or the topic you’d like to discuss" placeholder="Your story or the topic you’d like to discuss" rows={4} value={form.pitch} onChange={(e) => set('pitch', e.target.value)} error={errors.pitch} />
              <Honeypot value={website} onChange={setWebsite} />
              <FormAlert message={submit.error?.message ?? null} dark />
              <button type="submit" disabled={submit.submitting} className="press h-red" style={{ ...sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:17px;font-size:16px;font-weight:600;cursor:pointer'), opacity: submit.submitting ? 0.75 : 1 }}>
                {submit.submitting ? (
                  <>
                    <Spinner /> Sending…
                  </>
                ) : (
                  'Submit guest request'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
