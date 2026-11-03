import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Chip, ChipGroup, EYEBROW, Field, FormAlert, Honeypot, Spinner, focusFirstError } from '../components/ui';
import { submitPledge } from '../lib/api';
import { money, withFees } from '../lib/format';
import { sx } from '../lib/sx';
import { tile } from '../lib/theme';
import { useSubmit } from '../lib/useSubmit';
import { useTitle } from '../lib/useTitle';
import { hasErrors, MAX_PLEDGE_CENTS, validatePledge, type Errors, type PaymentMethod, type PledgeInput } from '../lib/validation';

const TIERS = [
  { name: 'Supporter', price: '$5/mo', v: 5, perks: 'Ad-free audio feed and the weekly briefing.' },
  { name: 'Insider', price: '$15/mo', v: 15, perks: 'Early access to premieres, monthly live Q&A with James, full transcripts.' },
  { name: 'Patron', price: '$50/mo', v: 50, perks: 'Everything in Insider, your name in episode credits, and an annual call with the newsroom.' },
];
const AMOUNTS = [5, 15, 25, 50, 100, 250];
const METHODS: PaymentMethod[] = ['Card', 'PayPal', 'Cash App', 'Zelle'];

/** Amount in cents from the preset or the free-text field (whole dollars only, as in the design). */
export function pledgeAmount(preset: number, custom: string): number {
  if (custom) return (Number.parseInt(custom, 10) || 0) * 100;
  return preset * 100;
}

export default function Support() {
  useTitle('Support');
  const [params] = useSearchParams();
  const initial = Number(params.get('amount'));
  const [tier, setTier] = useState<string | null>('Insider');
  const [freq, setFreq] = useState<'monthly' | 'once'>('monthly');
  const [amount, setAmount] = useState(() => (Number.isInteger(initial) && initial > 0 ? (AMOUNTS.includes(initial) ? initial : 0) : 25));
  const [custom, setCustom] = useState(() => (Number.isInteger(initial) && initial > 0 && !AMOUNTS.includes(initial) ? String(initial) : ''));
  const [method, setMethod] = useState<PaymentMethod>('Card');
  const [email, setEmail] = useState('');
  const [coverFees, setCoverFees] = useState(true);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors<PledgeInput>>({});
  const submit = useSubmit<string>();
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submit.done) doneRef.current?.focus();
  }, [submit.done]);

  const cents = pledgeAmount(amount, custom);
  const total = withFees(cents, coverFees);
  const summary = money(total) + (freq === 'monthly' ? ' monthly' : '');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: PledgeInput = { kind: 'donation', frequency: freq, amountCents: cents, coverFees, method, tier: freq === 'monthly' ? tier : null, fullName: '', email, agreed: true };
    const errs = validatePledge(input);
    setErrors(errs);
    if (hasErrors(errs)) {
      focusFirstError(e.currentTarget as HTMLFormElement);
      return;
    }
    void submit.run(() => submitPledge({ ...input, website }));
  };

  return (
    <section aria-labelledby="sup-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 96px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:64px;align-items:start')}>
      <div style={sx('display:flex;flex-direction:column;gap:24px')}>
        <div style={sx(EYEBROW + ';color:#D21034')}>Support</div>
        <h1 id="sup-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(44px,6vw,80px);font-weight:700;letter-spacing:-0.03em;line-height:1;text-wrap:balance")}>
          Keep the reporting independent.
        </h1>
        <p style={sx("margin:0;font-family:'Lora',serif;font-size:19px;line-height:1.6;color:#4A5578")}>Every dollar goes to field reporting, travel, four-language translation and production. James Reports carries no corporate owners.</p>
        <div role="group" aria-label="Membership tiers" style={sx('display:flex;flex-direction:column;gap:12px')}>
          {TIERS.map((t) => {
            const on = tier === t.name && freq === 'monthly' && !custom && amount === t.v;
            return (
              <button
                key={t.name}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setTier(t.name);
                  setAmount(t.v);
                  setCustom('');
                  setFreq('monthly');
                }}
                className="press"
                style={{ ...sx('text-align:left;display:grid;grid-template-columns:1fr auto;gap:8px 20px;padding:22px 24px;border-radius:12px;cursor:pointer;color:#0B1F5C'), background: on ? '#FDECEF' : '#FFFFFF', border: `1px solid ${on ? '#D21034' : '#E4E8F2'}` }}
              >
                <span style={sx("font-family:'Playfair Display',serif;font-size:22px;font-weight:700")}>{t.name}</span>
                <span style={sx("font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#D21034")}>{t.price}</span>
                <span style={sx('grid-column:1 / -1;font-size:14px;line-height:1.5;color:#4A5578')}>{t.perks}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="card-pad" style={sx('background:#FFFFFF;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,0.11);padding:36px;display:flex;flex-direction:column;gap:22px;position:sticky;top:100px')}>
        {submit.done ? (
          <div role="status" style={sx('display:flex;flex-direction:column;gap:14px;padding:12px 0')}>
            <span aria-hidden="true" style={sx("width:56px;height:56px;border-radius:999px;background:#D21034;display:grid;place-items:center;font-family:'Playfair Display',serif;font-weight:700;font-size:22px;color:#FFFFFF")}>JR</span>
            <h2 ref={doneRef} tabIndex={-1} style={sx("margin:0;font-family:'Playfair Display',serif;font-size:34px;font-weight:700;outline:none")}>
              Mèsi anpil.
            </h2>
            <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>
              Your {summary} pledge is saved as <b style={{ color: '#0B1F5C' }}>{submit.result}</b>. Online payment isn’t connected yet, so no money was taken. James’s team will email {email.trim()} a secure way to complete your gift by {method}.
            </p>
            <button type="button" onClick={submit.reset} style={sx('align-self:flex-start;background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer')}>
              Make another gift
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate aria-label="Make a gift" style={sx('display:flex;flex-direction:column;gap:22px;position:relative')}>
            <div role="group" aria-label="Frequency" style={sx('display:grid;grid-template-columns:1fr 1fr;background:#EEF1F8;border-radius:999px;padding:4px')}>
              {(
                [
                  ['monthly', 'Monthly'],
                  ['once', 'One time'],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={freq === k} onClick={() => setFreq(k)} style={{ ...sx('border:0;border-radius:999px;padding:12px;font-size:14px;font-weight:600;cursor:pointer'), background: freq === k ? '#0B1F5C' : 'transparent', color: freq === k ? '#F7F8FC' : '#0B1F5C' }}>
                  {label}
                </button>
              ))}
            </div>
            <ChipGroup label="Amount" labelCss="position:absolute;left:-10000px" wrapCss="display:flex;flex-direction:column;gap:10px" rowCss="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" error={errors.amountCents}>
              {AMOUNTS.map((v) => (
                <Chip
                  key={v}
                  on={!custom && amount === v}
                  onClick={() => {
                    setAmount(v);
                    setCustom('');
                    setTier(TIERS.find((t) => t.v === v)?.name ?? null);
                  }}
                  css="padding:16px 0;border-radius:8px;font-size:17px;font-weight:600"
                  look={tile}
                >
                  ${v}
                </Chip>
              ))}
            </ChipGroup>
            <div style={sx('display:flex;flex-direction:column;gap:6px')}>
              <label htmlFor="custom-amount" className="sr-only">
                Other amount in dollars
              </label>
              <div className="field" style={sx('display:flex;align-items:center;gap:8px;border:1px solid #CDD4E6;border-radius:8px;padding:0 16px;background:#FFFFFF')}>
                <span aria-hidden="true" style={sx('font-weight:600;color:#6B6B6B')}>$</span>
                <input
                  id="custom-amount"
                  value={custom}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                    setCustom(v);
                    setTier(null);
                  }}
                  placeholder="Other amount"
                  inputMode="numeric"
                  autoComplete="off"
                  style={sx('flex:1;border:0;outline:0;padding:14px 0;font-size:15px;background:transparent;color:#0B1F5C;min-width:0')}
                />
              </div>
              {Number(custom) * 100 > MAX_PLEDGE_CENTS && <span style={{ fontSize: 13, color: '#B00D2B' }}>For gifts over $100,000, please contact the team directly.</span>}
            </div>
            <ChipGroup label="Pay with" labelCss={EYEBROW + ';color:#6B6B6B'} rowCss="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
              {METHODS.map((m) => (
                <Chip key={m} on={method === m} onClick={() => setMethod(m)} css="padding:12px 0;border-radius:8px;font-size:13px;font-weight:600" look={tile}>
                  {m}
                </Chip>
              ))}
            </ChipGroup>
            <Field hideLabel label="Email for receipt" type="email" placeholder="Email for receipt" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <label style={sx('display:flex;gap:10px;align-items:center;font-size:14px;color:#4A5578;cursor:pointer')}>
              <input type="checkbox" checked={coverFees} onChange={() => setCoverFees(!coverFees)} style={sx('accent-color:#D21034;width:18px;height:18px;flex-shrink:0')} />
              Cover processing fees so 100% reaches James
            </label>
            <Honeypot value={website} onChange={setWebsite} />
            <FormAlert message={submit.error?.message ?? null} />
            <button type="submit" disabled={submit.submitting} className="press h-red" style={{ ...sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:18px;font-size:16px;font-weight:600;cursor:pointer'), opacity: submit.submitting ? 0.75 : 1 }}>
              {submit.submitting ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : cents > 0 ? (
                `Pledge ${summary}`
              ) : (
                'Choose an amount'
              )}
            </button>
            <p style={sx('margin:0;font-size:12px;line-height:1.5;color:#6B6B6B;text-align:center')}>No payment is taken on this page. Cancel a monthly gift anytime.</p>
          </form>
        )}
      </div>
    </section>
  );
}
