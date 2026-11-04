import { useEffect, useId, useRef, useState, type ComponentProps, type FocusEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { useConfig, useEpisodes } from '../lib/content';
import { sx } from '../lib/sx';
import { TOPIC_COVERS, TOPIC_DESC } from '../lib/theme';
import { TOPICS } from '../lib/types';
import { useOpenSubscribe } from './subscribe';
import { FlagBar } from './ui';

/** Header links as set in the admin (Site → Header & footer), visible ones only. */
export function useNavLinks(): Array<[string, string]> {
  const { cfg } = useConfig();
  return cfg.navigation.header.filter((l) => l.visible).map((l) => [l.href, l.label]);
}

/** A router link for site paths, a new-tab link for https:// addresses. */
export function SiteLink({ to, children, ...rest }: Readonly<Omit<ComponentProps<typeof Link>, 'to'> & { to: string }>) {
  if (/^https:\/\//.test(to)) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
}

type Menu = 'episodes' | 'podcast';

export function isActive(path: string, to: string): boolean {
  if (to === '/') return path === '/';
  if (to === '/episodes') return path.startsWith('/episodes');
  if (to === '/podcast') return path === '/podcast' || path === '/guest';
  return path === to;
}

function Chevron() {
  return <span aria-hidden="true" style={sx('width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg)')} />;
}

export function Header() {
  const { pathname } = useLocation();
  const openSubscribe = useOpenSubscribe();
  const episodes = useEpisodes();
  const links = useNavLinks();
  const { cfg } = useConfig();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  const counts = episodes.status === 'ready' ? episodes.data : [];
  const closeOnBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(null);
  };
  // Escape closes the menu and returns focus to its link; that focus must not reopen it.
  const suppressFocusOpen = useRef(false);
  const escape = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && menu) {
      setMenu(null);
      const link = e.currentTarget.querySelector('a');
      if (link && document.activeElement !== link) {
        suppressFocusOpen.current = true;
        link.focus();
      }
    }
  };
  const openOnFocus = (kind: Menu) => () => {
    if (suppressFocusOpen.current) {
      suppressFocusOpen.current = false;
      return;
    }
    setMenu(kind);
  };

  const podMenu = [
    { label: 'Watch now', desc: 'Stream the latest podcast episodes', icon: '▶', color: '#D21034', to: '/podcast' },
    { label: 'Guest request', desc: 'Apply to be a guest on the show', icon: 'JR', color: '#00209F', to: '/guest' },
  ];

  return (
    <header style={sx('position:sticky;top:0;z-index:40;background:rgba(247,248,252,0.92);backdrop-filter:blur(14px);border-bottom:1px solid #E4E8F2')}>
      <div className="hdr-inner" style={sx('max-width:1320px;margin:0 auto;padding:14px 32px;display:flex;align-items:center;gap:28px;flex-wrap:wrap')}>
        <Link to="/" aria-label={`${cfg.brand.siteName} ${cfg.brand.tagline} — home`} style={sx('display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;cursor:pointer;color:#0B1F5C')}>
          <span aria-hidden="true" style={sx("width:40px;height:40px;border-radius:999px;background:#00209F;color:#FFFFFF;display:grid;place-items:center;font-family:'Oswald',sans-serif;font-weight:700;font-size:16px;box-shadow:inset 0 -12px 0 #D21034;flex-shrink:0")}>JR</span>
          <span style={sx('display:flex;flex-direction:column;align-items:flex-start;line-height:1')}>
            <span className="brand-word" style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:22px;letter-spacing:0.02em;text-transform:uppercase;white-space:nowrap")}>
              <span style={{ color: '#D21034' }}>James</span> <span style={{ color: '#00209F' }}>Reports</span>
            </span>
            <span className="brand-sub" style={sx('font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#4A5578;margin-top:4px')}>{cfg.brand.tagline}</span>
          </span>
        </Link>

        <nav aria-label="Main" className="nav-desktop" style={sx('gap:4px;flex:1;flex-wrap:wrap')}>
          {links.map(([to, label]) => {
            const on = isActive(pathname, to);
            const kind: Menu | null = to === '/episodes' ? 'episodes' : to === '/podcast' ? 'podcast' : null;
            const open = kind !== null && menu === kind;
            return (
              <div
                key={to}
                style={{ position: 'relative' }}
                onMouseEnter={kind ? () => setMenu(kind) : undefined}
                onMouseLeave={kind ? () => setMenu(null) : undefined}
                onFocus={kind ? openOnFocus(kind) : undefined}
                onBlur={kind ? closeOnBlur : undefined}
                onKeyDown={kind ? escape : undefined}
              >
                <SiteLink
                  to={to}
                  className="nav-item"
                  aria-current={on ? 'page' : undefined}
                  aria-haspopup={kind ? 'true' : undefined}
                  aria-expanded={kind ? open : undefined}
                  onClick={() => setMenu(null)}
                  style={{ ...sx('background:none;border:0;cursor:pointer;padding:8px 14px;font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px'), color: on ? '#0B1F5C' : '#4A5578', borderBottom: `2px solid ${on ? '#D21034' : 'transparent'}` }}
                >
                  {label}
                  {kind && <Chevron />}
                </SiteLink>
                {open && kind === 'episodes' && (
                  <div style={sx('position:absolute;left:0;top:100%;padding-top:10px;z-index:60')}>
                    <div style={sx('width:320px;background:#FFFFFF;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.14);border:1px solid #E4E8F2;overflow:hidden')}>
                      <FlagBar h={3} />
                      <div style={sx('padding:16px 18px 8px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#6B6B6B')}>Browse by topic</div>
                      <div style={sx('display:flex;flex-direction:column;padding:0 8px 8px')}>
                        {TOPICS.map((t) => (
                          <Link
                            key={t}
                            to={`/episodes?topic=${encodeURIComponent(t)}`}
                            onClick={() => setMenu(null)}
                            className="h-soft"
                            style={sx('display:grid;grid-template-columns:10px 1fr auto;gap:12px;align-items:center;text-align:left;background:none;border:0;border-radius:8px;padding:10px;cursor:pointer;color:#0B1F5C')}
                          >
                            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: TOPIC_COVERS[t] }} />
                            <span style={sx('display:flex;flex-direction:column;gap:2px')}>
                              <span style={sx('font-size:15px;font-weight:600')}>{t}</span>
                              <span style={sx('font-size:12px;color:#4A5578')}>{TOPIC_DESC[t]}</span>
                            </span>
                            <span style={sx('font-size:12px;color:#6B6B6B;font-variant-numeric:tabular-nums')}>
                              {episodes.status === 'ready' ? (
                                <>
                                  {counts.filter((e) => e.topic === t).length}
                                  <span className="sr-only"> episodes</span>
                                </>
                              ) : null}
                            </span>
                          </Link>
                        ))}
                      </div>
                      <Link to="/episodes" onClick={() => setMenu(null)} style={sx('display:block;width:100%;text-align:left;background:#F7F8FC;border:0;border-top:1px solid #E4E8F2;padding:14px 18px;font-size:14px;font-weight:600;color:#D21034;cursor:pointer')}>
                        All episodes →
                      </Link>
                    </div>
                  </div>
                )}
                {open && kind === 'podcast' && (
                  <div style={sx('position:absolute;left:0;top:100%;padding-top:10px;z-index:60')}>
                    <div style={sx('width:300px;background:#FFFFFF;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.14);border:1px solid #E4E8F2;overflow:hidden')}>
                      <FlagBar h={3} />
                      <div style={sx('display:flex;flex-direction:column;padding:8px')}>
                        {podMenu.map((t) => (
                          <Link key={t.to} to={t.to} onClick={() => setMenu(null)} className="h-soft" style={sx('display:grid;grid-template-columns:36px 1fr;gap:12px;align-items:center;text-align:left;background:none;border:0;border-radius:8px;padding:10px;cursor:pointer;color:#0B1F5C')}>
                            <span aria-hidden="true" style={{ ...sx("width:36px;height:36px;border-radius:8px;color:#FFFFFF;display:grid;place-items:center;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700"), background: t.color }}>
                              {t.icon}
                            </span>
                            <span style={sx('display:flex;flex-direction:column;gap:2px')}>
                              <span style={sx('font-size:15px;font-weight:600')}>{t.label}</span>
                              <span style={sx('font-size:12px;color:#4A5578')}>{t.desc}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div style={sx('display:flex;align-items:center;gap:10px')}>
          <Link to="/vip" className="hdr-secondary h-navy press" style={{ ...sx('display:flex;align-items:center;gap:8px;border:0;color:#FFFFFF;border-radius:999px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer'), background: pathname === '/vip' ? '#00209F' : '#0B1F5C' }}>
            <span style={sx("font-family:'Oswald',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;background:#D21034;border-radius:4px;padding:2px 6px")}>VIP</span>Club
          </Link>
          <Link to="/support" className="hdr-secondary h-invert press" style={sx('background:transparent;border:1px solid #0B1F5C;color:#0B1F5C;border-radius:999px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer')}>
            Donate
          </Link>
          <button type="button" onClick={openSubscribe} className="press h-red sub-btn" style={sx('background:#D21034;border:0;color:#FFFFFF;border-radius:999px;padding:11px 20px;font-size:14px;font-weight:600;cursor:pointer')}>
            Subscribe
          </button>
          <button
            ref={toggleRef}
            type="button"
            className="nav-toggle"
            aria-expanded={mobileOpen}
            aria-controls={mobileId}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
            style={sx('width:44px;height:44px;border-radius:999px;border:1px solid #CDD4E6;background:#FFFFFF;color:#0B1F5C;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:4px')}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform 150ms ease-out, opacity 150ms',
                  transform: mobileOpen ? (i === 0 ? 'translateY(6px) rotate(45deg)' : i === 2 ? 'translateY(-6px) rotate(-45deg)' : 'none') : 'none',
                  opacity: mobileOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </div>

      <div
        id={mobileId}
        className="mobile-nav"
        data-open={mobileOpen}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setMobileOpen(false);
            toggleRef.current?.focus();
          }
        }}
        style={sx('border-top:1px solid #E4E8F2;background:#F7F8FC;max-height:calc(100vh - 72px);overflow-y:auto')}
      >
        <nav aria-label="Main (mobile)" style={sx('display:flex;flex-direction:column;padding:8px 20px 20px')}>
          {links.map(([to, label]) => {
            const on = isActive(pathname, to);
            return (
              <SiteLink key={to} to={to} aria-current={on ? 'page' : undefined} style={{ ...sx('padding:14px 4px;font-size:17px;font-weight:600;border-bottom:1px solid #E4E8F2;display:flex;justify-content:space-between;align-items:center'), color: on ? '#D21034' : '#0B1F5C' }}>
                {label}
                <span aria-hidden="true" style={{ color: '#8E9AC0' }}>→</span>
              </SiteLink>
            );
          })}
          <Link to="/guest" style={sx('padding:14px 4px;font-size:15px;font-weight:500;border-bottom:1px solid #E4E8F2;color:#4A5578')}>
            Be a guest on the show
          </Link>
          <div style={sx('display:flex;gap:10px;flex-wrap:wrap;padding-top:18px')}>
            <Link to="/vip" style={sx('display:flex;align-items:center;gap:8px;background:#0B1F5C;color:#FFFFFF;border-radius:999px;padding:12px 18px;font-size:15px;font-weight:600')}>
              <span style={sx("font-family:'Oswald',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;background:#D21034;border-radius:4px;padding:2px 6px")}>VIP</span>Club
            </Link>
            <Link to="/support" style={sx('border:1px solid #0B1F5C;color:#0B1F5C;border-radius:999px;padding:11px 18px;font-size:15px;font-weight:600')}>
              Donate
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
