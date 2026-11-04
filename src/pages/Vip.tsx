import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MediaImg } from '../components/Img';
import { Chip, ChipGroup, EYEBROW, Field, FlagBar, FormAlert, Honeypot, Spinner, focusFirstError } from '../components/ui';
import { submitPledge } from '../lib/api';
import { useConfig } from '../lib/content';
import { sx } from '../lib/sx';
import { tile } from '../lib/theme';
import { useSubmit } from '../lib/useSubmit';
import { useTitle } from '../lib/useTitle';
import { hasErrors, PAYMENT_METHODS, validatePledge, type Errors, type PaymentMethod, type PledgeInput } from '../lib/validation';

export const VIP_PRICE_CENTS = 4599;

const BENEFITS: Array<[string, string]> = [
  ['Early access to every episode', 'Watch and listen to new interviews 48 hours before they go public on YouTube and the site.'],
  ['VIP seat at podcast premieres', 'Join each premiere live with James in a members-only room, with your questions answered on air.'],
  ['Monthly live Q&A with James', 'A private video session every month to ask about the stories, the guests and what comes next.'],
  ['Ad-free, everywhere', 'Every episode, report and TV channel on the site without sponsor messages or interruptions.'],
  ['Exclusive VIP content', 'Extended cuts, unreleased interview segments, behind-the-scenes footage and reporter’s notes.'],
  ['Priority event invitations', 'First invitations and reserved seating at galas, live tapings and events James hosts.'],
  ['The VIP briefing', 'A members-only weekly letter from James in English, Français, Kreyòl or Español.'],
  ['Your name in the credits', 'VIP members are thanked by name in the credits of the episodes they help fund.'],
];

const COMPARE: Array<[string, string, string, string]> = [
  ['Episodes, reports and James Reports TV', '✓', '✓', '✓'],
  ['Weekly briefing', '✓', '✓', '✓'],
  ['Ad-free audio and video', '—', '✓', '✓'],
  ['48-hour early access', '—', '—', '✓'],
  ['VIP seat at podcast premieres', '—', '—', '✓'],
  ['Monthly live Q&A with James', '—', '—', '✓'],
  ['Exclusive content and extended cuts', '—', '—', '✓'],
  ['Priority event invitations', '—', '—', '✓'],
  ['Name in episode credits', '—', '—', '✓'],
];

const FAQ: Array<[string, string]> = [
  ['When do I get early access?', 'New episodes unlock for VIP members 48 hours before the public release, on the site and in the members-only audio feed.'],
  ['How do premieres work?', 'Each Thursday premiere opens a members-only room 15 minutes early. James takes VIP questions live during the show.'],
  ['Can I cancel anytime?', 'Yes. Contact the team to cancel. You keep VIP access until the end of the month you paid for.'],
  ['Is my membership tax-deductible?', 'No. James Reports is an independent media company, so memberships are not charitable donations.'],
];

/** What happens next for each payment method. No payment is taken on the site. */
export const METHOD_NOTES: Record<PaymentMethod, string> = {
  Card: 'James’s team will email you a secure card payment link for your $45.99 monthly membership.',
  PayPal: 'James’s team will email you a PayPal link to approve the $45.99 monthly subscription.',
  'Apple Pay': 'James’s team will email you a secure payment link you can complete with Apple Pay.',
  'Google Pay': 'James’s team will email you a secure payment link you can complete with Google Pay.',
  'Cash App': 'James’s team will email you the Cash App details for your $45.99 monthly membership.',
  Zelle: 'James’s team will email you the Zelle details. Your membership activates once payment is received.',
};

function renewDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Vip() {
  useTitle('VIP Club');
  const { slot } = useConfig();
  const [name, setName] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      <section aria-labelledby="vip-title" className="on-dark" style={sx('background:#050B22;color:#FFFFFF;overflow:hidden')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:56px;align-items:center')}>
          <div style={sx('display:flex;flex-direction:column;gap:26px')}>
            <span style={sx(EYEBROW + ';color:#FF8A9B')}>Membership</span>
            <h1 id="vip-title" style={sx("margin:0;font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(56px,7.4vw,112px);line-height:0.9;letter-spacing:0.01em;text-transform:uppercase")}>
              VIP <span style={{ color: '#FF8A9B' }}>Club</span>
            </h1>
            <p style={sx("margin:0;font-family:'Lora',serif;font-size:20px;line-height:1.55;color:#C3CCE6;max-width:540px")}>
              Early access to every episode, a seat at each podcast premiere and a direct line to James. Your membership funds the reporting.
            </p>
            <div style={sx('display:flex;align-items:baseline;gap:10px;flex-wrap:wrap')}>
              <span style={sx("font-family:'Oswald',sans-serif;font-size:64px;font-weight:700;line-height:1")}>$45.99</span>
              <span style={sx('font-size:16px;color:#C3CCE6')}>per month · cancel anytime</span>
            </div>
            <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
              <button type="button" onClick={() => scrollTo('vip-checkout')} className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:17px 30px;font-size:16px;font-weight:600;cursor:pointer')}>
                Join the VIP Club
              </button>
              <button type="button" onClick={() => scrollTo('vip-benefits')} className="press h-white-border" style={sx('background:transparent;color:#FFFFFF;border:1px solid rgba(247,248,252,0.4);border-radius:999px;padding:17px 30px;font-size:16px;font-weight:600;cursor:pointer')}>
                See the benefits
              </button>
            </div>
          </div>
          <div style={sx('position:relative;display:grid;place-items:center;padding:24px 0')}>
            <div style={sx('position:relative;width:100%;max-width:440px;aspect-ratio:4/5;border-radius:20px;overflow:hidden;background:#0B1F5C')}>
              <MediaImg media={slot('vipHero')} fallback="emmy-portrait.jpg" alt="James Pierre holding his Emmy award" eager sizes="(max-width: 960px) 100vw, 440px" />
            </div>
            <div aria-label="VIP member card preview" role="img" style={sx('position:absolute;left:0;bottom:0;width:min(78%,340px);aspect-ratio:1.586;border-radius:16px;background:#00209F;box-shadow:0 8px 24px rgba(0,0,0,0.4);overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:20px 22px')}>
              <div style={sx('position:absolute;left:0;right:0;bottom:0;height:42%;background:#D21034')} />
              <div style={sx('position:relative;display:flex;justify-content:space-between;align-items:flex-start')}>
                <span style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:18px;letter-spacing:0.04em;line-height:1")}>
                  JAMES
                  <br />
                  REPORTS
                </span>
                <span style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.12em;border:1px solid rgba(255,255,255,0.6);border-radius:4px;padding:3px 7px")}>VIP</span>
              </div>
              <div style={sx('position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:10px')}>
                <span style={sx('display:flex;flex-direction:column;gap:3px;min-width:0')}>
                  <span style={sx('font-size:10px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.85')}>Member</span>
                  <span style={sx('font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{name.trim() || 'Your name'}</span>
                </span>
                <span style={sx("font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:0.08em;font-variant-numeric:tabular-nums")}>{reference ?? 'JR-VIP-0000'}</span>
              </div>
            </div>
          </div>
        </div>
        <FlagBar />
      </section>

      <section id="vip-benefits" aria-labelledby="ben-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px')}>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px 56px;align-items:end;margin-bottom:44px')}>
          <div>
            <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>What VIP members get</div>
            <h2 id="ben-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,54px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
              First in line for everything James makes
            </h2>
          </div>
          <p style={sx('margin:0;font-size:17px;line-height:1.6;color:#4A5578')}>Members see and hear it before anyone else, join the conversation live and get closer to the reporting.</p>
        </div>
        <ol style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:20px;list-style:none;margin:0;padding:0')}>
          {BENEFITS.map(([t, d], i) => (
            <li key={t} className="h-lift card-pad" style={sx('background:#FFFFFF;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.07);padding:28px;display:flex;flex-direction:column;gap:12px;transition:transform 250ms ease-out')}>
              <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;letter-spacing:0.08em;color:#D21034")}>{String(i + 1).padStart(2, '0')}</span>
              <h3 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:23px;font-weight:700;line-height:1.2")}>{t}</h3>
              <p style={sx('margin:0;font-size:15px;line-height:1.55;color:#4A5578')}>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cmp-title" style={sx('background:#FFFFFF;border-top:1px solid #E4E8F2;border-bottom:1px solid #E4E8F2')}>
        <div className="wrap" style={sx('max-width:1100px;margin:0 auto;padding:80px 32px')}>
          <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Compare</div>
          <h2 id="cmp-title" style={sx("margin:0 0 32px;font-family:'Playfair Display',serif;font-size:clamp(30px,3.4vw,44px);font-weight:700;letter-spacing:-0.02em;line-height:1.1")}>
            Free, Supporter or VIP
          </h2>
          {/* position:relative keeps the cells' sr-only labels inside the scroller instead of widening the page */}
          <div style={{ overflowX: 'auto', position: 'relative' }} tabIndex={0} role="region" aria-labelledby="cmp-title">
            <table style={sx('min-width:560px;width:100%;border-collapse:collapse;border-top:2px solid #0B1F5C;table-layout:fixed')}>
              <colgroup>
                <col style={{ width: '40%' }} />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" style={sx(EYEBROW + ';padding:16px 12px 16px 0;color:#6B6B6B;text-align:left')}>Benefit</th>
                  <th scope="col" style={sx(EYEBROW + ';padding:16px 12px;text-align:center;color:#6B6B6B')}>Free</th>
                  <th scope="col" style={sx(EYEBROW + ';padding:16px 12px;text-align:center;color:#6B6B6B')}>Supporter</th>
                  <th scope="col" style={sx(EYEBROW + ';padding:16px 12px;text-align:center;color:#FFFFFF;background:#D21034;border-radius:8px 8px 0 0')}>VIP</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, free, sup, vip]) => (
                  <tr key={label}>
                    <th scope="row" style={sx('padding:16px 12px 16px 0;border-top:1px solid #E4E8F2;font-size:15px;color:#0B1F5C;text-align:left;font-weight:400')}>{label}</th>
                    {[free, sup].map((v, i) => (
                      <td key={i} style={{ ...sx('padding:16px 12px;border-top:1px solid #E4E8F2;text-align:center;font-size:15px;font-weight:600'), color: v === '✓' ? '#0B1F5C' : '#B7C0D8' }}>
                        <span aria-hidden="true">{v}</span>
                        <span className="sr-only">{v === '✓' ? 'Included' : 'Not included'}</span>
                      </td>
                    ))}
                    <td style={sx('padding:16px 12px;border-top:1px solid #F5C9D1;text-align:center;font-size:15px;font-weight:700;color:#D21034;background:#FDECEF')}>
                      <span aria-hidden="true">{vip}</span>
                      <span className="sr-only">Included</span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" style={sx('padding:16px 12px 16px 0;border-top:2px solid #0B1F5C;font-size:15px;font-weight:700;color:#0B1F5C;text-align:left')}>Price</th>
                  <td style={sx('padding:16px 12px;border-top:2px solid #0B1F5C;text-align:center;font-size:15px;font-weight:600')}>$0</td>
                  <td style={sx('padding:16px 12px;border-top:2px solid #0B1F5C;text-align:center;font-size:15px;font-weight:600')}>$5/mo</td>
                  <td style={sx("padding:16px 12px;border-top:2px solid #0B1F5C;text-align:center;font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;color:#FFFFFF;background:#D21034;border-radius:0 0 8px 8px")}>$45.99/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="vip-checkout" aria-labelledby="join-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px 96px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:56px;align-items:start')}>
        <div style={sx('display:flex;flex-direction:column;gap:22px')}>
          <div style={sx(EYEBROW + ';color:#D21034')}>Join</div>
          <h2 id="join-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,54px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
            Become a VIP member
          </h2>
          <div className="on-dark" style={sx('background:#0B1F5C;color:#FFFFFF;border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:14px')}>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px')}>
              <span style={sx('font-size:16px;font-weight:600')}>James Reports VIP Club</span>
              <span style={sx("font-family:'Oswald',sans-serif;font-size:24px;font-weight:700")}>$45.99</span>
            </div>
            <div style={sx('display:flex;justify-content:space-between;gap:12px;font-size:14px;color:#C3CCE6')}>
              <span>Billed monthly</span>
              <span>Renews {renewDate()}</span>
            </div>
            <div style={sx('height:1px;background:rgba(247,248,252,0.14)')} />
            <div style={sx('display:flex;justify-content:space-between;gap:12px;font-size:16px;font-weight:700')}>
              <span>Due at payment</span>
              <span>$45.99</span>
            </div>
          </div>
          <Faq />
        </div>
        <VipForm name={name} setName={setName} onJoined={setReference} />
      </section>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <div style={sx('display:flex;flex-direction:column')}>
      <h3 style={sx(EYEBROW + ';color:#6B6B6B;margin:0 0 6px')}>Questions</h3>
      {FAQ.map(([q, a], i) => (
        <div key={q} style={sx('border-top:1px solid #CDD4E6')}>
          <h4 style={{ margin: 0 }}>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={`${base}-${i}`}
              onClick={() => setOpen(open === i ? -1 : i)}
              style={sx('width:100%;display:flex;justify-content:space-between;gap:16px;align-items:center;text-align:left;background:none;border:0;padding:18px 0;font-size:16px;font-weight:600;color:#0B1F5C;cursor:pointer')}
            >
              {q}
              <span aria-hidden="true" style={sx('font-size:20px;font-weight:400;color:#D21034')}>
                {open === i ? '−' : '+'}
              </span>
            </button>
          </h4>
          <div id={`${base}-${i}`} hidden={open !== i}>
            <p style={sx('margin:0 0 18px;font-size:15px;line-height:1.6;color:#4A5578')}>{a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function VipForm({ name, setName, onJoined }: Readonly<{ name: string; setName: (v: string) => void; onJoined: (ref: string) => void }>) {
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Card');
  const [agreed, setAgreed] = useState(true);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors<PledgeInput>>({});
  const submit = useSubmit<string>();
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submit.done && submit.result) {
      onJoined(submit.result);
      doneRef.current?.focus();
    }
  }, [submit.done, submit.result, onJoined]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: PledgeInput = { kind: 'vip', frequency: 'monthly', amountCents: VIP_PRICE_CENTS, coverFees: false, method, tier: 'VIP', fullName: name, email, agreed };
    const errs = validatePledge(input);
    setErrors(errs);
    if (hasErrors(errs)) {
      focusFirstError(e.currentTarget as HTMLFormElement);
      return;
    }
    void submit.run(() => submitPledge({ ...input, website }));
  };

  return (
    <div className="card-pad" style={sx('background:#FFFFFF;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,0.11);padding:36px')}>
      {submit.done ? (
        <div role="status" style={sx('display:flex;flex-direction:column;gap:16px')}>
          <span style={sx(EYEBROW + ';color:#D21034')}>Request received</span>
          <h3 ref={doneRef} tabIndex={-1} style={sx("margin:0;font-family:'Playfair Display',serif;font-size:36px;font-weight:700;line-height:1.1;outline:none")}>
            Mèsi, your VIP spot is reserved.
          </h3>
          <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>
            Your request <b style={{ color: '#0B1F5C' }}>{submit.result}</b> is saved. No payment was taken: online checkout isn’t connected yet, so James’s team will email {email.trim()} to set up your $45.99 monthly
            payment by {method}. Early access and premiere invitations start once your first payment is confirmed.
          </p>
          <div style={sx('display:flex;gap:10px;flex-wrap:wrap')}>
            <Link to="/episodes" className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
              Browse episodes
            </Link>
            <Link to="/watch" className="press h-invert" style={sx('background:transparent;color:#0B1F5C;border:1px solid #0B1F5C;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
              Open James Reports TV
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate aria-label="VIP membership request" style={sx('display:flex;flex-direction:column;gap:22px;position:relative')}>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
            <Field hideLabel label="Full name" placeholder="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.fullName} />
            <Field hideLabel label="Email" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          </div>
          <ChipGroup label="Payment method" labelCss={EYEBROW + ';color:#6B6B6B'} rowCss="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
            {PAYMENT_METHODS.map((m) => (
              <Chip key={m} on={method === m} onClick={() => setMethod(m)} css="padding:14px 6px;border-radius:8px;font-size:14px;font-weight:600" look={tile}>
                {m}
              </Chip>
            ))}
          </ChipGroup>
          <div aria-live="polite" style={sx('background:#F7F8FC;border:1px solid #E4E8F2;border-radius:8px;padding:16px;font-size:15px;line-height:1.5;color:#0B1F5C')}>
            {METHOD_NOTES[method]}
          </div>
          <div style={sx('display:flex;flex-direction:column;gap:6px')}>
            <label style={sx('display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5;color:#4A5578;cursor:pointer')}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
                data-invalid={errors.agreed ? 'true' : undefined}
                aria-describedby={errors.agreed ? 'vip-agree-err' : undefined}
                style={sx('accent-color:#D21034;width:18px;height:18px;margin-top:1px;flex-shrink:0')}
              />
              I agree to be billed $45.99 each month until I cancel.
            </label>
            {errors.agreed && (
              <span id="vip-agree-err" style={{ fontSize: 13, color: '#B00D2B' }}>
                {errors.agreed}
              </span>
            )}
          </div>
          <Honeypot value={website} onChange={setWebsite} />
          <FormAlert message={submit.error?.message ?? null} />
          <button
            type="submit"
            disabled={submit.submitting}
            className={agreed ? 'press h-red' : 'press'}
            style={{ ...sx('color:#FFFFFF;border:0;border-radius:999px;padding:18px;font-size:16px;font-weight:600;cursor:pointer'), background: agreed ? '#D21034' : '#8E9AC0', opacity: submit.submitting ? 0.75 : 1 }}
          >
            {submit.submitting ? (
              <>
                <Spinner /> Saving…
              </>
            ) : agreed ? (
              'Reserve my VIP membership'
            ) : (
              'Agree to the terms to continue'
            )}
          </button>
          <p style={sx('margin:0;font-size:12px;line-height:1.5;color:#6B6B6B;text-align:center')}>No payment is taken on this page. You’ll pay through a secure link from James’s team.</p>
        </form>
      )}
    </div>
  );
}
