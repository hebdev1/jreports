import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EYEBROW, Field, FlagBar, FormAlert, Honeypot, Spinner, focusFirstError } from '../components/ui';
import { signTalentRelease, type SignedRelease } from '../lib/api';
import { longDate } from '../lib/format';
import { sx } from '../lib/sx';
import { useSubmit } from '../lib/useSubmit';
import { useTitle } from '../lib/useTitle';
import { hasErrors, validateRelease, type Errors, type ReleaseInput } from '../lib/validation';

/** Bump when the wording below changes; it is stored with every signature. */
export const TERMS_VERSION = '2026-09';

export const TERMS: Array<[string, string]> = [
  ['Grant of rights', 'I grant James Reports and James Pierre (together, the “Producer”), and their licensees, successors and assigns, the irrevocable right to record, use, reproduce, edit, publish, broadcast, stream and distribute my name, image, likeness, voice, statements, biographical information and appearance (the “Appearance”) in the program James Reports and in any related promotion, advertising, clips, trailers and social media, in all media now known or later developed, worldwide and in perpetuity.'],
  ['Copyright assignment', 'To the extent I have any copyright or other intellectual property interest in the recordings, footage, audio, photographs or transcripts made of my Appearance (the “Recordings”), I assign all right, title and interest in them to the Producer. The Producer is the sole owner of the Recordings and of the program, and may register copyrights in its own name.'],
  ['Editing and use', 'The Producer may edit, cut, translate, subtitle, rearrange or combine the Recordings with other material at its sole discretion, and is not obligated to use or publish the Recordings.'],
  ['No compensation', 'I agree that I am not entitled to any payment, royalty or other compensation for my Appearance or for any use of the Recordings, unless agreed in a separate written agreement signed by the Producer.'],
  ['Release of claims', 'I release and discharge the Producer, its sponsors, distributors and partners from any claims arising from the use of the Recordings as permitted in this release, including claims for invasion of privacy, right of publicity, defamation or infringement of moral rights.'],
  ['My representations', 'The information I provide is true to the best of my knowledge. I will not share confidential information or third-party material that I do not have the right to disclose. I have the full right to sign this release.'],
  ['Governing law', 'This release is governed by the laws of the State of Florida. It is the entire agreement between us on this subject, and a signed electronic copy has the same effect as an original.'],
];

const CHECKS = [
  'I have read and understand the release terms above.',
  'I grant James Reports permission to record and use my name, image, likeness and voice in the show and its promotion.',
  'I assign to James Reports all copyright in the recordings of my appearance.',
  'I agree that I will not receive compensation for my appearance.',
];

const EMPTY: ReleaseInput = {
  legalName: '', screenName: '', email: '', phone: '', address: '', dateOfBirth: '', episode: '', recordingDate: '',
  isMinor: false, guardianName: '', guardianRelationship: '', consents: [false, false, false, false], signature: '',
};

const CARD = 'background:#FFFFFF;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,0.07);padding:36px;display:flex;flex-direction:column';
const H2 = "margin:0;font-family:'Playfair Display',serif;font-size:28px;font-weight:700";
const SIG = "font-family:'Mrs Saint Delafield',cursive;line-height:1.1;color:#0B1F5C";

export default function Release() {
  useTitle('Talent release form');
  const [form, setForm] = useState<ReleaseInput>(EMPTY);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors<ReleaseInput>>({});
  const submit = useSubmit<SignedRelease>();
  const doneRef = useRef<HTMLHeadingElement>(null);
  const set = <K extends keyof ReleaseInput>(k: K, v: ReleaseInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const today = longDate(new Date());
  const ready = form.consents.every(Boolean) && form.signature.trim().length > 2;

  useEffect(() => {
    if (submit.done) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      doneRef.current?.focus({ preventScroll: true });
    }
  }, [submit.done]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateRelease(form);
    setErrors(errs);
    if (hasErrors(errs)) {
      focusFirstError(e.currentTarget as HTMLFormElement);
      return;
    }
    void submit.run(() => signTalentRelease({ ...form, website }, TERMS_VERSION));
  };

  const signed = submit.done && submit.result;
  const signedOn = signed ? longDate(new Date(submit.result!.signedAt)) : today;
  const signer = form.isMinor ? form.guardianName : form.legalName;

  return (
    <div>
      <section aria-labelledby="rel-title" className="on-dark no-print" style={sx('background:#081230;color:#FFFFFF')}>
        <div className="wrap" style={sx('max-width:1100px;margin:0 auto;padding:64px 32px 56px;display:flex;flex-direction:column;gap:18px')}>
          <span style={sx(EYEBROW + ';color:#FF8A9B')}>For guests · Legal</span>
          <h1 id="rel-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(40px,5.4vw,72px);font-weight:700;letter-spacing:-0.03em;line-height:1")}>
            Talent release form
          </h1>
          <p style={sx("margin:0;font-family:'Lora',serif;font-size:19px;line-height:1.55;color:#C3CCE6;max-width:700px")}>
            Every guest signs this release before recording. It gives James Reports permission to use your appearance in the show and transfers the copyright in the recordings to James Reports.
          </p>
          <ul style={sx('display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#C3CCE6;list-style:none;margin:0;padding:0')}>
            {['About 5 minutes', 'Electronic signature', 'Printable copy'].map((t) => (
              <li key={t} style={sx('border:1px solid rgba(247,248,252,0.25);border-radius:999px;padding:6px 12px')}>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <FlagBar />
      </section>

      <section className="wrap" style={sx('max-width:1100px;margin:0 auto;padding:56px 32px 96px')}>
        {signed ? (
          <>
            <div role="status" className="no-print card-pad" style={sx('background:#FFFFFF;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,0.11);padding:40px;display:flex;flex-direction:column;gap:16px')}>
              <span style={sx(EYEBROW + ';color:#D21034')}>Release signed</span>
              <h2 ref={doneRef} tabIndex={-1} style={sx("margin:0;font-family:'Playfair Display',serif;font-size:38px;font-weight:700;line-height:1.1;outline:none")}>
                Thank you, you’re cleared for the show.
              </h2>
              <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>
                Document <b style={{ color: '#0B1F5C' }}>{submit.result!.reference}</b> was signed on {signedOn}. The James Reports team has it on file. Print or save a copy for your records.
              </p>
              <div style={sx(SIG + ';font-size:52px;border-bottom:1px solid #CDD4E6;padding-bottom:6px;max-width:420px;overflow-wrap:anywhere')}>{form.signature.trim()}</div>
              <div style={sx('display:flex;gap:10px;flex-wrap:wrap')}>
                <button type="button" onClick={() => window.print()} className="press h-navy" style={sx('background:#0B1F5C;color:#FFFFFF;border:0;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
                  Print a copy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(EMPTY);
                    setErrors({});
                    submit.reset();
                  }}
                  className="press h-invert"
                  style={sx('background:transparent;color:#0B1F5C;border:1px solid #0B1F5C;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}
                >
                  Sign for another guest
                </button>
              </div>
            </div>
            <PrintCopy form={form} reference={submit.result!.reference} signedOn={signedOn} />
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate aria-labelledby="rel-title" style={sx('display:flex;flex-direction:column;gap:28px;position:relative')}>
            <div role="group" aria-labelledby="rel-s1" className="card-pad" style={sx(CARD + ';gap:22px')}>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap')}>
                <h2 id="rel-s1" style={sx(H2)}>1. Guest details</h2>
                <span style={sx('font-size:13px;color:#6B6B6B')}>All fields required</span>
              </div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px')}>
                <Field label="Full legal name" placeholder="As it appears on your ID" autoComplete="name" required value={form.legalName} onChange={(e) => set('legalName', e.target.value)} error={errors.legalName} />
                <Field label="Name as shown on screen" placeholder="e.g. Dr. Marie Joseph" required value={form.screenName} onChange={(e) => set('screenName', e.target.value)} error={errors.screenName} />
                <Field label="Email" type="email" placeholder="you@example.com" autoComplete="email" required value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
                <Field label="Phone" type="tel" placeholder="(305) 000-0000" autoComplete="tel" required value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
                <Field label="Mailing address" placeholder="Street, city, state, ZIP" autoComplete="street-address" required value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
                <Field label="Date of birth" type="date" autoComplete="bday" required value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} error={errors.dateOfBirth} />
                <Field label="Episode or segment" placeholder="e.g. EP 49 · TPS update" required value={form.episode} onChange={(e) => set('episode', e.target.value)} error={errors.episode} />
                <Field label="Recording date" type="date" required value={form.recordingDate} onChange={(e) => set('recordingDate', e.target.value)} error={errors.recordingDate} />
              </div>
              <label style={sx('display:flex;gap:10px;align-items:center;font-size:15px;color:#0B1F5C;cursor:pointer')}>
                <input type="checkbox" checked={form.isMinor} onChange={() => setForm((f) => ({ ...f, isMinor: !f.isMinor }))} style={sx('accent-color:#D21034;width:18px;height:18px')} />
                The guest is under 18
              </label>
              {form.isMinor && (
                <div style={sx('background:#FDECEF;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:14px')}>
                  <span style={sx('font-size:14px;line-height:1.5;color:#5A0A1A')}>A parent or legal guardian must sign on behalf of a minor.</span>
                  <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px')}>
                    <Field label="Parent or guardian name" placeholder="Full legal name" required value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} error={errors.guardianName} />
                    <Field label="Relationship to guest" placeholder="e.g. Mother" required value={form.guardianRelationship} onChange={(e) => set('guardianRelationship', e.target.value)} error={errors.guardianRelationship} />
                  </div>
                </div>
              )}
            </div>

            <div role="group" aria-labelledby="rel-s2" className="card-pad" style={sx(CARD + ';gap:18px')}>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap')}>
                <h2 id="rel-s2" style={sx(H2)}>2. Release terms</h2>
                <span style={sx('font-size:13px;color:#6B6B6B')}>Please read carefully</span>
              </div>
              <ol tabIndex={0} aria-label="Release terms" style={sx('max-height:420px;overflow-y:auto;border:1px solid #E4E8F2;border-radius:12px;padding:8px 24px;background:#F7F8FC;list-style:none;margin:0')}>
                {TERMS.map(([t, body], i) => (
                  <li key={t} style={{ ...sx('display:grid;grid-template-columns:36px 1fr;gap:12px;padding:18px 0'), borderBottom: i === TERMS.length - 1 ? 0 : '1px solid #E4E8F2' }}>
                    <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:#D21034")}>{String(i + 1).padStart(2, '0')}</span>
                    <div style={sx('display:flex;flex-direction:column;gap:6px')}>
                      <span style={sx('font-size:16px;font-weight:700;color:#0B1F5C')}>{t}</span>
                      <span style={sx('font-size:15px;line-height:1.65;color:#4A5578')}>{body}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <div style={sx('display:flex;flex-direction:column;gap:12px;padding-top:4px')}>
                {CHECKS.map((label, i) => (
                  <label key={label} style={sx('display:flex;gap:12px;align-items:flex-start;font-size:15px;line-height:1.5;color:#0B1F5C;cursor:pointer')}>
                    <input
                      type="checkbox"
                      checked={form.consents[i]}
                      data-invalid={errors.consents && !form.consents[i] ? 'true' : undefined}
                      aria-describedby={errors.consents ? 'rel-consents-err' : undefined}
                      onChange={() => setForm((f) => ({ ...f, consents: f.consents.map((v, j) => (j === i ? !v : v)) as ReleaseInput['consents'] }))}
                      style={sx('accent-color:#D21034;width:18px;height:18px;margin-top:2px;flex-shrink:0')}
                    />
                    {label}
                  </label>
                ))}
                {errors.consents && (
                  <span id="rel-consents-err" style={{ fontSize: 13, color: '#B00D2B' }}>
                    {errors.consents}
                  </span>
                )}
              </div>
            </div>

            <div role="group" aria-labelledby="rel-s3" className="card-pad" style={sx(CARD + ';gap:20px')}>
              <h2 id="rel-s3" style={sx(H2)}>3. Signature</h2>
              <Field
                label={form.isMinor ? 'Parent or guardian: type your full legal name to sign' : 'Type your full legal name to sign'}
                placeholder="Full legal name"
                autoComplete="off"
                required
                value={form.signature}
                onChange={(e) => set('signature', e.target.value)}
                error={errors.signature}
                hint={signer.trim() ? `It must match: ${signer.trim()}` : undefined}
              />
              <div aria-hidden="true" style={sx('position:relative;border:1px dashed #CDD4E6;border-radius:12px;background:#F7F8FC;min-height:120px;padding:20px 24px;display:flex;flex-direction:column;justify-content:flex-end')}>
                <span style={{ ...sx(SIG + ';font-size:56px;overflow-wrap:anywhere'), color: form.signature ? '#0B1F5C' : '#CDD4E6' }}>{form.signature || 'Your signature'}</span>
                <div style={sx('border-top:1px solid #0B1F5C;margin-top:4px;display:flex;justify-content:space-between;gap:12px;padding-top:8px;font-size:12px;color:#6B6B6B')}>
                  <span>Signature of guest{form.isMinor ? ' (parent or guardian)' : ''}</span>
                  <span>{today}</span>
                </div>
              </div>
              <Honeypot value={website} onChange={setWebsite} />
              <FormAlert message={submit.error?.message ?? null} />
              <button
                type="submit"
                disabled={submit.submitting}
                className={ready ? 'press h-red' : 'press'}
                style={{ ...sx('color:#FFFFFF;border:0;border-radius:999px;padding:18px;font-size:16px;font-weight:600;cursor:pointer'), background: ready ? '#D21034' : '#8E9AC0', opacity: submit.submitting ? 0.75 : 1 }}
              >
                {submit.submitting ? (
                  <>
                    <Spinner /> Signing…
                  </>
                ) : ready ? (
                  'Sign release'
                ) : (
                  'Check all boxes and sign to continue'
                )}
              </button>
              <p style={sx('margin:0;font-size:12px;line-height:1.5;color:#6B6B6B;text-align:center')}>
                By signing electronically you agree your typed name has the same legal effect as a handwritten signature. Your IP address and time of signing are recorded.
              </p>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

/** Shown only when printing: the signed release as a single document. */
function PrintCopy({ form, reference, signedOn }: Readonly<{ form: ReleaseInput; reference: string; signedOn: string }>) {
  const row = (k: string, v: string) => (
    <tr key={k}>
      <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', fontWeight: 600, verticalAlign: 'top' }}>{k}</th>
      <td style={{ padding: '4px 0' }}>{v}</td>
    </tr>
  );
  return (
    <div className="print-only" style={{ color: '#000', fontSize: 12, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>James Reports — Talent release</h1>
      <p style={{ margin: '0 0 12px' }}>
        Document {reference} · Signed {signedOn} · Terms version {TERMS_VERSION}
      </p>
      <table style={{ borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          {row('Full legal name', form.legalName)}
          {row('Name on screen', form.screenName)}
          {row('Email', form.email)}
          {row('Phone', form.phone)}
          {row('Mailing address', form.address)}
          {row('Date of birth', form.dateOfBirth)}
          {row('Episode or segment', form.episode)}
          {row('Recording date', form.recordingDate)}
          {form.isMinor ? row('Parent or guardian', `${form.guardianName} (${form.guardianRelationship})`) : null}
        </tbody>
      </table>
      <ol style={{ paddingLeft: 18 }}>
        {TERMS.map(([t, body]) => (
          <li key={t} style={{ marginBottom: 6 }}>
            <b>{t}.</b> {body}
          </li>
        ))}
      </ol>
      <p>Accepted: {CHECKS.join(' · ')}</p>
      <p style={{ fontFamily: "'Mrs Saint Delafield', cursive", fontSize: 36, margin: '16px 0 0' }}>{form.signature.trim()}</p>
      <p style={{ borderTop: '1px solid #000', paddingTop: 4, margin: 0 }}>
        Signature of guest{form.isMinor ? ' (parent or guardian)' : ''} · {signedOn}
      </p>
    </div>
  );
}
