import { useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { subscribeNewsletter } from '../lib/api';
import { useConfig, useSiteConfig } from '../lib/content';
import { sx } from '../lib/sx';
import { withHandle } from '../lib/format';
import { useSubmit } from '../lib/useSubmit';
import { hasErrors, validateNewsletter } from '../lib/validation';
import { GuestRequestSection } from './GuestRequestSection';
import { Header, SiteLink, useNavLinks } from './Header';
import { MiniPlayer, PlayerProvider, usePlayer } from './player';
import { SubscribeProvider } from './subscribe';
import { Field, FlagBar, FormAlert, Honeypot, Spinner } from './ui';

export function Layout() {
  return (
    <PlayerProvider>
      <SubscribeProvider>
        <Shell />
      </SubscribeProvider>
    </PlayerProvider>
  );
}

function Shell() {
  const { pathname, search, hash } = useLocation();
  const player = usePlayer();

  // The design scrolled to the top on every page change.
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  // Keep focus order sensible after navigation: move focus to <main>.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [hash, pathname, search]);

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FC', paddingBottom: player.episode ? 110 : 0 }}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <FlagBar />
      <SettingsNotice />
      <Ticker />
      <Header />
      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <Outlet />
      </main>
      <NewsletterSection />
      <GuestRequestSection />
      <Footer />
      <MiniPlayer />
    </div>
  );
}

/** Says so when the managed settings couldn't load, instead of silently showing older values. */
function SettingsNotice() {
  const config = useSiteConfig();
  if (config.status !== 'error') return null;
  return (
    <div role="status" className="no-print" style={sx('background:#FFF4E5;color:#0B1F5C;font-size:13px;border-bottom:1px solid #F3D9B1')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:8px 32px;display:flex;gap:12px;align-items:center;flex-wrap:wrap')}>
        <span style={{ flex: 1, minWidth: 220 }}>Some site information couldn’t be loaded, so parts of this page may be out of date.</span>
        <button type="button" onClick={config.retry} style={sx('background:none;border:0;border-bottom:1px solid #0B1F5C;padding:2px 0;font-size:13px;font-weight:600;color:#0B1F5C;cursor:pointer')}>
          Try again
        </button>
      </div>
    </div>
  );
}

function Ticker() {
  const { cfg, status } = useConfig();
  const t = cfg.ticker;
  // Only announce what was actually saved; never show the launch announcement on a failed load.
  if (status !== 'ready' || !t.enabled || !t.text) return null;
  return (
    <div className="on-dark no-print" style={sx('background:#081230;color:#F7F8FC;font-size:13px;letter-spacing:0.04em')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:10px 32px;display:flex;align-items:center;gap:20px;flex-wrap:wrap')}>
        <span style={sx('display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;font-size:11px;color:#FF8A9B')}>
          <span className="live-dot" aria-hidden="true" style={sx('width:8px;height:8px;border-radius:999px;background:#D32F2F;display:inline-block')} /> {t.label}
        </span>
        <span style={sx('flex:1;min-width:220px;color:#EEF1F8')}>{t.text}</span>
        {t.linkUrl && (
          <a href={t.linkUrl} target="_blank" rel="noopener noreferrer" className="h-white-text" style={sx('color:#FF8A9B;font-weight:600')}>
            {t.linkLabel || 'Learn more'} →<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
    </div>
  );
}

function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | undefined>();
  const submit = useSubmit<void>();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = { email, language: 'English' as const, alerts: { premiere: true, briefing: true, breaking: false } };
    const errs = validateNewsletter(input);
    setError(errs.email);
    if (hasErrors(errs)) return;
    void submit.run(() => subscribeNewsletter({ ...input, website }, 'footer'));
  };

  return (
    <section aria-labelledby="nl-title" className="on-dark no-print" style={sx('background:#0B1F5C;color:#F7F8FC')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:40px;align-items:center')}>
        <div>
          <h2 id="nl-title" style={sx("margin:0 0 12px;font-family:'Playfair Display',serif;font-size:clamp(32px,4vw,48px);font-weight:700;letter-spacing:-0.02em;line-height:1.05")}>
            The James Reports briefing
          </h2>
          <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#C3CCE6;max-width:480px')}>New episodes, TPS and immigration updates, and news from Haiti. Weekly, in your language.</p>
        </div>
        {submit.done ? (
          <div role="status" style={sx("font-family:'Lora',serif;font-size:20px;color:#FF8A9B")}>
            You're subscribed. Look for the first briefing on Friday.
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate style={sx('display:flex;flex-direction:column;gap:10px;position:relative')}>
            <div style={sx('display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start')}>
              <Field
                label="Your email"
                hideLabel
                dark
                type="email"
                autoComplete="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
                wrapCss="display:flex;flex-direction:column;gap:6px;flex:1;min-width:220px"
                style={sx('padding:16px 20px;border:1px solid rgba(247,248,252,0.3);border-radius:999px;background:transparent;color:#F7F8FC;font-size:15px')}
              />
              <button type="submit" disabled={submit.submitting} className="press h-red" style={{ ...sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer'), opacity: submit.submitting ? 0.75 : 1 }}>
                {submit.submitting ? (
                  <>
                    <Spinner /> Subscribing…
                  </>
                ) : (
                  'Subscribe'
                )}
              </button>
            </div>
            <Honeypot value={website} onChange={setWebsite} />
            <FormAlert message={submit.error?.message ?? null} dark />
          </form>
        )}
      </div>
    </section>
  );
}

function Footer() {
  const { cfg } = useConfig();
  const links = useNavLinks();
  const social = [
    [cfg.social.youtube, withHandle('YouTube', cfg.social.youtube)],
    [cfg.social.facebook, 'Facebook'],
    [cfg.social.x, withHandle('X', cfg.social.x)],
    [cfg.social.vimeo, 'Vimeo'],
  ].filter(([href]) => href);
  const link = 'background:none;border:0;padding:0;text-align:left;color:#C3CCE6;font-size:14px;cursor:pointer';
  const head = 'font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#FF8A9B';
  return (
    <footer className="on-dark" style={sx('background:#081230;color:#C3CCE6')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:64px 32px 44px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:40px 32px')}>
        <div style={sx('display:flex;flex-direction:column;gap:14px;grid-column:span 1;min-width:0')}>
          <span style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:26px;letter-spacing:0.02em;text-transform:uppercase;color:#FFFFFF")}>
            James <span style={{ color: '#FF8A9B' }}>Reports</span>
          </span>
          {cfg.brand.description && <span style={sx("font-family:'Lora',serif;font-style:italic;font-size:15px;line-height:1.5")}>{cfg.brand.description}</span>}
          {cfg.footer.languages && <span style={sx('font-size:13px;color:#8E9AC0')}>{cfg.footer.languages}</span>}
          <FlagBar h={3} style={{ width: 48, marginTop: 4 }} />
        </div>
        <nav aria-label="Explore" style={sx('display:flex;flex-direction:column;gap:10px')}>
          <span style={sx(head)}>Explore</span>
          {links.map(([to, label]) => (
            <SiteLink key={to} to={to} className="h-pink-text" style={sx(link)}>
              {label}
            </SiteLink>
          ))}
        </nav>
        <nav aria-label="Guests" style={sx('display:flex;flex-direction:column;gap:10px')}>
          <span style={sx(head)}>Guests</span>
          <Link to="/guest" className="h-pink-text" style={sx('background:none;border:0;padding:0;text-align:left;color:#FFFFFF;font-size:14px;font-weight:600;cursor:pointer')}>
            Guest request
          </Link>
          <Link to="/release" className="h-pink-text" style={sx('background:none;border:0;padding:0;text-align:left;color:#FFFFFF;font-size:14px;font-weight:600;cursor:pointer')}>
            Talent release form
          </Link>
          <span style={sx('font-size:12px;line-height:1.5;color:#8E9AC0;margin-top:4px')}>Booked guests sign the release before recording.</span>
        </nav>
        <nav aria-label="Partners" style={sx('display:flex;flex-direction:column;gap:10px')}>
          <span style={sx(head)}>Partners</span>
          <Link to="/booking" className="h-pink-text" style={sx(link)}>
            Bookings
          </Link>
          <Link to="/booking?tab=ads" className="h-pink-text" style={sx(link)}>
            Sponsors &amp; advertising
          </Link>
          <Link to="/vip" className="h-pink-text" style={sx(link)}>
            VIP Club
          </Link>
          <Link to="/support" className="h-pink-text" style={sx(link)}>
            Donate
          </Link>
        </nav>
        <div style={sx('display:flex;flex-direction:column;gap:10px;font-size:14px')}>
          <span style={sx(head)}>Follow</span>
          {social.map(([href, label]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="h-pink-text" style={{ color: '#C3CCE6' }}>
              {label}
            </a>
          ))}
        </div>
      </div>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:20px 32px 28px;border-top:1px solid rgba(247,248,252,0.1);font-size:12px;color:#8E9AC0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap')}>
        <span>
          © {new Date().getFullYear()} {cfg.brand.siteName}. All rights reserved.
        </span>
        <span style={sx('display:flex;gap:20px')}>
          {cfg.footer.privacyUrl ? (
            <a href={cfg.footer.privacyUrl} target="_blank" rel="noopener noreferrer" className="h-pink-text" style={{ color: '#8E9AC0' }}>
              Privacy
            </a>
          ) : (
            <span>Privacy</span>
          )}
          {cfg.footer.termsUrl ? (
            <a href={cfg.footer.termsUrl} target="_blank" rel="noopener noreferrer" className="h-pink-text" style={{ color: '#8E9AC0' }}>
              Terms
            </a>
          ) : (
            <span>Terms</span>
          )}
        </span>
      </div>
    </footer>
  );
}
