import { useEffect, useRef, useState, type Dispatch, type FormEvent, type RefObject, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router';
import { Img } from '../components/Img';
import { Chip, ChipGroup, EYEBROW, Field, FlagBar, FormAlert, Honeypot, Spinner, TextArea, focusFirstError } from '../components/ui';
import { submitBookingRequest } from '../lib/api';
import { sx } from '../lib/sx';
import { chip } from '../lib/theme';
import { LANGUAGES } from '../lib/types';
import { useSubmit } from '../lib/useSubmit';
import { useTitle } from '../lib/useTitle';
import { AUDIENCES, BUDGETS, hasErrors, REQUEST_TYPES, validateBooking, type BookingInput, type Errors } from '../lib/validation';

type Tab = 'events' | 'ads';
const CLIENTS = ['FCC', 'Humana', 'FPL', 'DoorDash', 'Kay Jewelers', 'City National Bank', 'Conviva', 'Simple Mobile'];

const SERVICES: Array<{ img: string; alt: string; pos?: string; kicker: string; title: string; body: string; items: string[] }> = [
  {
    img: 'event-hosting-floor.jpg', alt: 'James Pierre hosting on the dance floor at the FowenNurses gala', kicker: 'Event hosting', title: 'Master of ceremonies',
    body: 'Galas, award ceremonies, conferences and festivals, run on time and on script, with seamless switches between languages.',
    items: ['Galas & award nights', 'Conferences & panels', 'Cultural festivals', 'Nonprofit fundraisers'],
  },
  {
    img: 'event-stage-gold.jpg', alt: 'James Pierre speaking on stage in a gold jacket', kicker: 'Public appearances', title: 'Keynotes & appearances',
    body: 'Motivational talks, moderated conversations and guest appearances for schools, companies and community organizations.',
    items: ['Keynote & motivational talks', 'Panel moderation', 'School & university visits', 'Red carpet & media appearances'],
  },
  {
    img: 'james-field.png', pos: '50% 15%', alt: 'James Pierre reporting in the field with a James Reports microphone', kicker: 'Sponsored coverage', title: 'Sponsored reports',
    body: 'Field reporting and produced segments about your event, launch or initiative, published on James Reports and labeled as sponsored.',
    items: ['On-site event coverage', 'Produced feature segments', 'Interview packages', 'Multilingual cut-downs for social'],
  },
];

const AD_PRODUCTS: Array<[string, string, string, string]> = [
  ['YouTube · Audio', 'Episode sponsor', 'A host-read message at the open and mid-point of an episode, recorded by James in the language of the episode.', 'Pre-roll 30s · Mid-roll 60s'],
  ['Multi-episode', 'Series presenting partner', 'Exclusive "presented by" billing across a themed series, such as immigration explainers or election coverage.', '4–8 episodes · Logo on screen'],
  ['Newsletter', 'Briefing placement', 'A single sponsor slot in the weekly James Reports briefing, delivered in the subscriber’s chosen language.', 'Logo, 60 words, one link'],
  ['YouTube · Instagram · Facebook', 'Shorts & social', 'Vertical video integrations produced with James for short-form feeds.', '15–60s vertical · Up to 3 cuts'],
  ['Public service', 'Community PSA', 'Announcements for public health, legal aid, census and civic participation. Reduced rates for nonprofits.', '30s spot · Four languages'],
  ['Branded content', 'Custom production', 'Commercials and campaigns produced by James and his team, drawing on more than 1,000 spots to date.', 'Script, shoot, edit, deliver'],
];

const MEDIA_KIT = 'mailto:ads@jamesreports.com?subject=' + encodeURIComponent('Media kit request');

function emptyForm(tab: Tab): BookingInput {
  return {
    requestType: tab === 'ads' ? 'Advertising' : 'Event hosting', fullName: '', organization: '', email: '', phone: '', eventDate: '', venue: '',
    audience: '100–500', campaignStart: '', product: '', languages: ['English', 'Kreyòl'], budget: '$2.5k–$10k', message: '',
  };
}

export default function Booking() {
  useTitle('Booking & partnerships');
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'ads' ? 'ads' : 'events';
  const [form, setForm] = useState<BookingInput>(() => emptyForm(tab));
  const formRef = useRef<HTMLElement>(null);

  const setTab = (t: Tab, scroll = false) => {
    setParams(t === 'ads' ? { tab: 'ads' } : {}, { replace: true, preventScrollReset: true });
    setForm((f) => ({ ...f, requestType: t === 'ads' ? 'Advertising' : f.requestType === 'Advertising' ? 'Event hosting' : f.requestType }));
    if (scroll) setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  // Keep the request type in step when the tab changes through the URL (back/forward, footer links).
  useEffect(() => {
    setForm((f) => (tab === 'ads' ? { ...f, requestType: 'Advertising' } : f.requestType === 'Advertising' ? { ...f, requestType: 'Event hosting' } : f));
  }, [tab]);

  const toForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      <section aria-labelledby="bk-title" className="on-dark" style={sx('background:#081230;color:#FFFFFF;overflow:hidden')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:56px;align-items:end')}>
          <div style={sx('display:flex;flex-direction:column;gap:26px;padding-bottom:72px')}>
            <span style={sx(EYEBROW + ';color:#FF8A9B')}>Booking &amp; partnerships</span>
            <h1 id="bk-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(44px,5.8vw,84px);line-height:0.98;letter-spacing:-0.03em;text-wrap:balance")}>
              Bring James to your stage and your audience.
            </h1>
            <p style={sx("margin:0;font-family:'Lora',serif;font-size:20px;line-height:1.55;color:#C3CCE6;max-width:560px")}>
              Event hosting, keynotes, public appearances, sponsored coverage and advertising on James Reports. In English, French, Haitian Creole and Spanish.
            </p>
            <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
              <button type="button" onClick={() => setTab('events', true)} className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
                Book an appearance
              </button>
              <button type="button" onClick={() => setTab('ads', true)} className="press h-white-border" style={sx('background:transparent;color:#FFFFFF;border:1px solid rgba(247,248,252,0.4);border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
                Advertise with us
              </button>
            </div>
            <dl className="stat-3" style={sx('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:rgba(247,248,252,0.14);border-top:1px solid rgba(247,248,252,0.14);margin:12px 0 0')}>
              {[
                ['4×', 'Emmy Award winner', 'padding:20px 20px 0 0'],
                ['4', 'Languages on stage', 'padding:20px 20px 0'],
                ['1,000+', 'Commercials produced', 'padding:20px 0 0 20px'],
              ].map(([n, l, pad]) => (
                <div key={l} style={sx('background:#081230;display:flex;flex-direction:column-reverse;' + pad)}>
                  <dt style={sx('font-size:13px;color:#C3CCE6;margin-top:6px')}>{l}</dt>
                  <dd className="stat-num" style={sx("margin:0;font-family:'Oswald',sans-serif;font-size:34px;font-weight:700;line-height:1")}>{n}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div style={sx('position:relative;aspect-ratio:4/5;border-radius:20px 20px 0 0;overflow:hidden;background:#0B1F5C')}>
            <Img src="event-smile-blue.jpg" alt="James Pierre smiling in a blue tuxedo jacket while hosting an evening event" eager sizes="(max-width: 960px) 100vw, 620px" />
            <FlagBar h={6} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }} />
          </div>
        </div>
      </section>

      <section aria-label="Clients" style={sx('background:#FFFFFF;border-bottom:1px solid #E4E8F2')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:22px 32px;display:flex;gap:32px;align-items:center;flex-wrap:wrap')}>
          <span style={sx(EYEBROW + ';color:#6B6B6B')}>James has produced for</span>
          <ul style={sx('display:flex;gap:28px;flex-wrap:wrap;align-items:center;flex:1;list-style:none;margin:0;padding:0')}>
            {CLIENTS.map((c) => (
              <li key={c} style={sx("font-family:'Oswald',sans-serif;font-weight:500;font-size:17px;letter-spacing:0.04em;text-transform:uppercase;color:#4A5578")}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div style={sx('background:#F7F8FC;border-bottom:1px solid #E4E8F2')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:14px 32px;display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
          <div role="group" aria-label="Show services for" style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
            {(
              [
                ['events', 'Events & appearances'],
                ['ads', 'Advertising'],
              ] as Array<[Tab, string]>
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className="press" style={{ ...sx('border-radius:999px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer'), ...chip(tab === k) }}>
                {label}
              </button>
            ))}
          </div>
          <span style={sx('flex:1')} />
          <button type="button" onClick={toForm} style={sx('background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer')}>
            Go to request form ↓
          </button>
        </div>
      </div>

      {tab === 'events' ? <EventServices /> : <AdProducts />}
      <Gallery />
      <HowItWorks />
      <BookingFormSection formRef={formRef} form={form} setForm={setForm} onTab={setTab} />
    </div>
  );
}

function EventServices() {
  return (
    <section aria-labelledby="svc-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px')}>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px 56px;align-items:end;margin-bottom:44px')}>
        <h2 id="svc-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,54px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
          Hosting, appearances and sponsored coverage
        </h2>
        <p style={sx('margin:0;font-size:17px;line-height:1.6;color:#4A5578')}>From galas in Miami to classrooms in the Caribbean, James brings two decades of live broadcast experience to every room.</p>
      </div>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:24px')}>
        {SERVICES.map((s) => (
          <article key={s.title} style={sx('background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);display:flex;flex-direction:column')}>
            <div style={sx('position:relative;aspect-ratio:4/3;background:#DDE3F0')}>
              <Img src={s.img} alt={s.alt} position={s.pos} sizes="(max-width: 900px) 100vw, 420px" />
            </div>
            <div className="card-pad" style={sx('padding:28px;display:flex;flex-direction:column;gap:14px;flex:1')}>
              <span style={sx(EYEBROW + ';color:#D21034')}>{s.kicker}</span>
              <h3 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:28px;font-weight:700;line-height:1.15")}>{s.title}</h3>
              <p style={sx('margin:0;font-size:15px;line-height:1.6;color:#4A5578')}>{s.body}</p>
              <ul style={sx('display:flex;flex-direction:column;border-top:1px solid #E4E8F2;margin-top:auto;list-style:none;padding:0;margin-bottom:0')}>
                {s.items.map((i) => (
                  <li key={i} style={sx('display:flex;gap:12px;align-items:baseline;padding:11px 0;border-bottom:1px solid #E4E8F2;font-size:14px;color:#0B1F5C')}>
                    <span aria-hidden="true" style={sx('width:6px;height:6px;border-radius:999px;background:#D21034;flex-shrink:0;transform:translateY(-2px)')} />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdProducts() {
  return (
    <section aria-labelledby="ads-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px')}>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px 56px;align-items:end;margin-bottom:44px')}>
        <h2 id="ads-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,54px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
          Reach the Haitian diaspora, in its own languages
        </h2>
        <div style={sx('display:flex;flex-direction:column;gap:16px;align-items:flex-start')}>
          <p style={sx('margin:0;font-size:17px;line-height:1.6;color:#4A5578')}>
            James Reports reaches Haitian and Caribbean audiences across the United States, Canada, France and Haiti, with Spanish-speaking viewers across South Florida.
          </p>
          <a href={MEDIA_KIT} className="press h-navy" style={sx('background:#0B1F5C;color:#FFFFFF;border:0;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
            Request the media kit<span className="sr-only"> by email</span>
          </a>
        </div>
      </div>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:20px')}>
        {AD_PRODUCTS.map(([tag, title, body, spec], i) => (
          <article key={title} className="h-blue-border card-pad" style={sx('background:#FFFFFF;border:1px solid #E4E8F2;border-radius:12px;padding:28px;display:flex;flex-direction:column;gap:12px')}>
            <div style={sx('display:flex;justify-content:space-between;align-items:center;gap:12px')}>
              <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;color:#D21034;letter-spacing:0.08em")}>{String(i + 1).padStart(2, '0')}</span>
              <span style={sx(EYEBROW + ';color:#6B6B6B;text-align:right')}>{tag}</span>
            </div>
            <h3 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:24px;font-weight:700;line-height:1.2")}>{title}</h3>
            <p style={sx('margin:0;font-size:15px;line-height:1.55;color:#4A5578')}>{body}</p>
            <span style={sx('margin-top:auto;padding-top:12px;border-top:1px solid #E4E8F2;font-size:13px;color:#0B1F5C')}>{spec}</span>
          </article>
        ))}
      </div>
      <div className="card-pad" style={sx('margin-top:32px;background:#E6EBF8;border-radius:20px;padding:32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px 48px')}>
        <div style={sx('display:flex;flex-direction:column;gap:10px')}>
          <span style={sx(EYEBROW + ';color:#00209F')}>Editorial standards</span>
          <h3 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:26px;font-weight:700;line-height:1.2")}>Advertisers don’t shape the news.</h3>
        </div>
        <ul style={sx('display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:1.55;color:#0B1F5C;list-style:none;margin:0;padding:0')}>
          <li>Sponsored segments are labeled on screen and in show notes.</li>
          <li>Sponsors have no say over news coverage, guests or questions.</li>
          <li>Political campaign advertising is reviewed case by case.</li>
        </ul>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section aria-labelledby="gal-title" style={sx('background:#FFFFFF;border-top:1px solid #E4E8F2')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px')}>
        <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px 40px;flex-wrap:wrap;margin-bottom:32px')}>
          <div>
            <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Recently hosted</div>
            <h2 id="gal-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(32px,3.6vw,48px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
              FowenNurses Gala
            </h2>
          </div>
          <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578;max-width:460px')}>James served as master of ceremonies for the FowenNurses celebration.</p>
        </div>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px')}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={sx('position:relative;aspect-ratio:21/9;border-radius:12px;overflow:hidden;background:#DDE3F0')}>
              <Img src="event-fowen-group.jpg" alt="Guests in blue gather on the dance floor at the FowenNurses gala" sizes="(max-width: 1320px) 100vw, 1256px" />
            </div>
          </div>
          {[
            ['event-hosting-floor.jpg', 'James Pierre hosting from the FowenNurses gala floor', '50% 50%'],
            ['event-mic-blue.jpg', 'James Pierre speaking into a microphone at the FowenNurses gala', '50% 50%'],
            ['event-fowen-backdrop.jpg', 'James Pierre in a blue suit in front of the FowenNurses backdrop', '50% 15%'],
          ].map(([src, alt, pos]) => (
            <div key={src} style={sx('position:relative;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#DDE3F0')}>
              <Img src={src} alt={alt} position={pos} sizes="(max-width: 700px) 100vw, 420px" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps: Array<[string, string, string]> = [
    ['01', 'Send a request', 'Tell us the date, place, audience and what you have in mind.'],
    ['02', 'Proposal', 'Availability, scope and rates within two business days.'],
    ['03', 'Confirm', 'Agreement, deposit and a prep call with James.'],
    ['04', 'Show day', 'James arrives prepared, on script and in the right language.'],
  ];
  return (
    <section aria-labelledby="how-title" className="on-dark" style={sx('background:#0B1F5C;color:#FFFFFF')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px')}>
        <h2 id="how-title" style={sx(EYEBROW + ';margin:0;color:#FF8A9B')}>How it works</h2>
        <ol style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:0;margin:28px 0 0;padding:0;list-style:none;border-top:1px solid rgba(247,248,252,0.14);border-left:1px solid rgba(247,248,252,0.14)')}>
          {steps.map(([n, t, d]) => (
            <li key={n} style={sx('background:#0B1F5C;padding:28px;border-right:1px solid rgba(247,248,252,0.14);border-bottom:1px solid rgba(247,248,252,0.14);display:flex;flex-direction:column;gap:10px')}>
              <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-size:40px;font-weight:700;color:#FF8A9B;line-height:1")}>{n}</span>
              <span style={sx("font-family:'Playfair Display',serif;font-size:22px;font-weight:700")}>{t}</span>
              <span style={sx('font-size:14px;line-height:1.55;color:#C3CCE6')}>{d}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BookingFormSection({
  formRef,
  form,
  setForm,
  onTab,
}: Readonly<{ formRef: RefObject<HTMLElement | null>; form: BookingInput; setForm: Dispatch<SetStateAction<BookingInput>>; onTab: (t: Tab) => void }>) {
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors<BookingInput>>({});
  const submit = useSubmit<string>();
  const doneRef = useRef<HTMLHeadingElement>(null);
  const isAd = form.requestType === 'Advertising';
  const set = <K extends keyof BookingInput>(k: K, v: BookingInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (submit.done) doneRef.current?.focus();
  }, [submit.done]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateBooking(form);
    setErrors(errs);
    if (hasErrors(errs)) {
      focusFirstError(e.currentTarget as HTMLFormElement);
      return;
    }
    void submit.run(() => submitBookingRequest({ ...form, website }));
  };

  const eyebrow = EYEBROW + ';color:#6B6B6B';
  const pill = 'border-radius:999px;padding:8px 14px;font-size:14px;font-weight:500';

  return (
    <section ref={formRef} id="booking-form" aria-labelledby="bf-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px 96px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:56px;align-items:start')}>
      <div style={sx('display:flex;flex-direction:column;gap:20px')}>
        <span style={sx(EYEBROW + ';color:#D21034')}>Request form</span>
        <h2 id="bf-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,54px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
          Start a booking or ad request
        </h2>
        <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>A member of James’s team reviews every request and replies within two business days.</p>
        <div style={sx('display:flex;flex-direction:column;gap:6px;padding-top:20px;border-top:1px solid #CDD4E6;font-size:15px')}>
          <span style={sx(eyebrow)}>Direct</span>
          <a href="mailto:booking@jamesreports.com" style={{ fontWeight: 600 }}>
            booking@jamesreports.com
          </a>
          <a href="mailto:ads@jamesreports.com" style={{ fontWeight: 600 }}>
            ads@jamesreports.com
          </a>
        </div>
      </div>
      <div className="card-pad" style={sx('background:#FFFFFF;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,0.11);padding:36px')}>
        {submit.done ? (
          <div role="status" style={sx('display:flex;flex-direction:column;gap:14px')}>
            <span style={sx(EYEBROW + ';color:#D21034')}>Request received</span>
            <h3 ref={doneRef} tabIndex={-1} style={sx("margin:0;font-family:'Playfair Display',serif;font-size:34px;font-weight:700;outline:none")}>
              Thank you. We’ll be in touch.
            </h3>
            <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578')}>
              Your {form.requestType.toLowerCase()} request is logged as <b style={{ color: '#0B1F5C' }}>{submit.result}</b>. A member of James’s team will reply to {form.email.trim()} within two business days.
            </p>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...emptyForm(f.requestType === 'Advertising' ? 'ads' : 'events'), requestType: f.requestType }));
                setErrors({});
                submit.reset();
              }}
              style={sx('align-self:flex-start;background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer')}
            >
              Send another request
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate aria-label="Booking or ad request" style={sx('display:flex;flex-direction:column;gap:24px;position:relative')}>
            <ChipGroup label="Request type" labelCss={eyebrow} rowCss="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
              {REQUEST_TYPES.map((t) => (
                <Chip
                  key={t}
                  on={form.requestType === t}
                  onClick={() => {
                    set('requestType', t);
                    onTab(t === 'Advertising' ? 'ads' : 'events');
                  }}
                  css="text-align:left;padding:14px 16px;border-radius:8px;font-size:14px;font-weight:600"
                  look={chip}
                >
                  {t}
                </Chip>
              ))}
            </ChipGroup>
            <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
              <Field hideLabel label="Full name" placeholder="Full name" autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
              <Field hideLabel label="Organization or brand (optional)" placeholder="Organization or brand" autoComplete="organization" value={form.organization} onChange={(e) => set('organization', e.target.value)} error={errors.organization} />
              <Field hideLabel label="Email" type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
              <Field hideLabel label="Phone (optional)" type="tel" placeholder="Phone" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
            </div>
            {isAd ? (
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
                <Field label="Campaign start date (optional)" type="date" value={form.campaignStart} onChange={(e) => set('campaignStart', e.target.value)} error={errors.campaignStart} labelCss="font-size:13px;color:#4A5578" />
                <Field label="Product or message (optional)" placeholder="Product or message" value={form.product} onChange={(e) => set('product', e.target.value)} error={errors.product} labelCss="font-size:13px;color:#4A5578" />
              </div>
            ) : (
              <div style={sx('display:flex;flex-direction:column;gap:12px')}>
                <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px')}>
                  <Field label="Event date (optional)" type="date" value={form.eventDate} onChange={(e) => set('eventDate', e.target.value)} error={errors.eventDate} labelCss="font-size:13px;color:#4A5578" />
                  <Field label="City or venue (optional)" placeholder="City or venue" value={form.venue} onChange={(e) => set('venue', e.target.value)} error={errors.venue} labelCss="font-size:13px;color:#4A5578" />
                </div>
                <ChipGroup label="Expected audience" labelCss="font-size:14px;color:#4A5578;margin-right:6px" wrapCss="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  {AUDIENCES.map((a) => (
                    <Chip key={a} on={form.audience === a} onClick={() => set('audience', a)} css="border-radius:999px;padding:8px 14px;font-size:13px;font-weight:500" look={chip}>
                      {a}
                    </Chip>
                  ))}
                </ChipGroup>
              </div>
            )}
            <ChipGroup label="Languages" labelCss={eyebrow} error={errors.languages}>
              {LANGUAGES.map((l) => (
                <Chip key={l} on={form.languages.includes(l)} onClick={() => setForm((f) => ({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l] }))} css={pill} look={chip}>
                  {l}
                </Chip>
              ))}
            </ChipGroup>
            <ChipGroup label="Budget range" labelCss={eyebrow}>
              {BUDGETS.map((b) => (
                <Chip key={b} on={form.budget === b} onClick={() => set('budget', b)} css={pill} look={chip}>
                  {b}
                </Chip>
              ))}
            </ChipGroup>
            <TextArea hideLabel label="Tell us about the event, campaign or story" placeholder="Tell us about the event, campaign or story" rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} error={errors.message} />
            <Honeypot value={website} onChange={setWebsite} />
            <FormAlert message={submit.error?.message ?? null} />
            <button type="submit" disabled={submit.submitting} className="press h-red" style={{ ...sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:18px;font-size:16px;font-weight:600;cursor:pointer'), opacity: submit.submitting ? 0.75 : 1 }}>
              {submit.submitting ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                'Send request'
              )}
            </button>
            <p style={sx('margin:0;font-size:12px;line-height:1.5;color:#6B6B6B;text-align:center')}>Your details are used only to respond to this request.</p>
          </form>
        )}
      </div>
    </section>
  );
}
