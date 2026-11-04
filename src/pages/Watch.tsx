import { useEffect, useRef, useState } from 'react';
import { ytPlaylist, ytVideo } from '../components/blocks';
import { EYEBROW } from '../components/ui';
import { sx } from '../lib/sx';
import { useChannelUrl, useConfig } from '../lib/content';
import { UPLOADS_PLAYLIST, type WatchChannel } from '../lib/siteConfig';
import { useTitle } from '../lib/useTitle';

export function channelSrc(c: WatchChannel, muted: boolean): string {
  const m = muted ? 1 : 0;
  return c.videoId
    ? ytVideo(c.videoId, `autoplay=1&mute=${m}&start=${c.start}&loop=1&playlist=${c.videoId}&rel=0&modestbranding=1`)
    : ytPlaylist(c.playlistId || UPLOADS_PLAYLIST, `&autoplay=1&mute=${m}&loop=1&rel=0&modestbranding=1`);
}

/** "James Reports TV": YouTube channels presented as a live TV screen. */
export default function Watch() {
  useTitle('Watch James Reports TV');
  // Channels, headlines and the premiere slot are set in the admin (Site → Watch & podcast).
  const { watch } = useConfig().cfg;
  const channel = useChannelUrl();
  const CHANNELS = watch.channels;
  const HEADS = watch.headlines;
  const [chosen, setCh] = useState(0);
  const ch = Math.min(chosen, CHANNELS.length - 1);
  const [muted, setMuted] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const screen = useRef<HTMLDivElement>(null);
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const c = CHANNELS[ch];
  const d = new Date(now);
  const clockText = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' · ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const slot = new Date(d);
  slot.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  const guide = [0, 1, 2, 3, 4].map((i) => {
    const t = new Date(slot.getTime() + i * 1_800_000);
    return { time: i === 0 ? 'Now' : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), name: CHANNELS[(ch + i) % CHANNELS.length].guideLabel || CHANNELS[(ch + i) % CHANNELS.length].name, current: i === 0 };
  });
  const btn = 'background:transparent;color:#FFFFFF;border:1px solid rgba(247,248,252,0.35);border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer';

  return (
    <section aria-labelledby="tv-title" className="on-dark" style={sx('background:#050B22;color:#FFFFFF;min-height:80vh')}>
      <div className="wrap" style={sx('max-width:1440px;margin:0 auto;padding:28px 32px 64px;display:flex;flex-direction:column;gap:20px')}>
        <div style={sx('display:flex;align-items:center;gap:16px;flex-wrap:wrap')}>
          <span style={sx(EYEBROW + ';display:flex;align-items:center;gap:8px;background:#D21034;border-radius:4px;padding:6px 10px;color:#FFFFFF')}>
            <span className="live-dot" aria-hidden="true" style={sx('width:7px;height:7px;border-radius:999px;background:#FFFFFF;display:inline-block')} /> On air
          </span>
          <h1 id="tv-title" style={sx("margin:0;font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase")}>
            James Reports <span style={{ color: '#FF8A9B' }}>TV</span>
          </h1>
          <span style={sx('flex:1')} />
          <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-size:20px;font-weight:500;font-variant-numeric:tabular-nums;color:#C3CCE6")}>
            {clockText}
          </span>
        </div>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,620px),1fr));gap:20px;align-items:start')}>
          <div style={sx('display:flex;flex-direction:column;gap:0;min-width:0')}>
            <div ref={screen} style={sx('position:relative;aspect-ratio:16/9;background:#000;border-radius:12px 12px 0 0;overflow:hidden')}>
              <iframe
                key={`${ch}-${muted}`}
                src={channelSrc(c, muted)}
                title={`James Reports TV — channel ${ch + 1}, ${c.name}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                style={sx('position:absolute;inset:0;width:100%;height:100%;border:0')}
              />
              <div aria-hidden="true" style={sx('position:absolute;right:16px;top:16px;pointer-events:none;display:flex;flex-direction:column;align-items:flex-end;line-height:1;background:rgba(5,11,34,0.55);padding:6px 8px;border-radius:4px')}>
                <span style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:15px;color:#FFFFFF;letter-spacing:0.04em")}>JAMES</span>
                <span style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:11px;color:#FF8A9B;letter-spacing:0.08em")}>REPORTS</span>
              </div>
            </div>
            <div style={sx('display:grid;grid-template-columns:auto minmax(0,1fr);background:#0B1F5C;border-radius:0 0 12px 12px;overflow:hidden')}>
              <span aria-live="polite" style={sx("background:#D21034;padding:12px 16px;font-family:'Oswald',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center")}>
                CH {ch + 1} · {c.name}
              </span>
              <div style={sx('overflow:hidden;display:flex;align-items:center')}>
                <div className="ticker-run" aria-hidden="true">
                  {[...HEADS, ...HEADS].map((t, i) => (
                    <span key={i} style={sx('display:inline-flex;align-items:center;gap:14px;padding:0 22px;font-size:14px;font-weight:500;color:#FFFFFF')}>
                      <span style={sx('width:6px;height:6px;background:#D21034;display:inline-block')} />
                      {t}
                    </span>
                  ))}
                </div>
                <ul className="sr-only">
                  {HEADS.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={sx('display:flex;gap:10px;flex-wrap:wrap;margin-top:16px')}>
              <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={!muted} className="press" style={sx('background:#FFFFFF;color:#050B22;border:0;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer')}>
                {muted ? 'Turn sound on' : 'Mute'}
              </button>
              {canFullscreen && (
                <button type="button" onClick={() => screen.current?.requestFullscreen().catch(() => undefined)} className="press h-white-border" style={sx(btn)}>
                  Full screen
                </button>
              )}
              <button type="button" onClick={() => setCh((n) => (n + 1) % CHANNELS.length)} className="press h-white-border" style={sx(btn)}>
                Next channel →
              </button>
              <span style={sx('flex:1')} />
              <a href={channel} target="_blank" rel="noopener noreferrer" className="h-white-border" style={sx('border:1px solid rgba(247,248,252,0.35);color:#FFFFFF;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600')}>
                Open on YouTube
              </a>
            </div>
          </div>
          <aside aria-label="Channels and program guide" style={sx('display:flex;flex-direction:column;gap:20px')}>
            <div style={sx('background:#081230;border:1px solid rgba(247,248,252,0.1);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px')}>
              <h2 style={sx(EYEBROW + ';margin:0;color:#FF8A9B')}>Channels</h2>
              {CHANNELS.map((x, i) => (
                <button
                  key={`${i}-${x.name}`}
                  type="button"
                  onClick={() => setCh(i)}
                  aria-pressed={i === ch}
                  style={{ ...sx('display:grid;grid-template-columns:48px 1fr;gap:14px;align-items:center;text-align:left;padding:12px;border-radius:8px;cursor:pointer;color:#FFFFFF'), background: i === ch ? '#0B1F5C' : 'transparent', border: `1px solid ${i === ch ? '#00209F' : 'rgba(247,248,252,0.08)'}` }}
                >
                  <span style={{ ...sx("font-family:'Oswald',sans-serif;font-size:22px;font-weight:700"), color: i === ch ? '#FF8A9B' : '#8E9AC0' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={sx('display:flex;flex-direction:column;gap:3px')}>
                    <span style={sx('font-size:15px;font-weight:600')}>{x.name}</span>
                    <span style={sx('font-size:12px;color:#C3CCE6')}>{x.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <div style={sx('background:#081230;border:1px solid rgba(247,248,252,0.1);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:4px')}>
              <h2 style={sx(EYEBROW + ';margin:0 0 8px;color:#FF8A9B')}>Program guide · today</h2>
              {guide.map((g) => (
                <div key={g.time + g.name} style={sx('display:grid;grid-template-columns:72px 1fr;gap:12px;padding:10px 0;border-top:1px solid rgba(247,248,252,0.08)')}>
                  <span style={{ ...sx('font-variant-numeric:tabular-nums;font-size:13px;font-weight:600'), color: g.current ? '#FF8A9B' : '#8E9AC0' }}>{g.time}</span>
                  <span style={{ fontSize: 14, color: g.current ? '#FFFFFF' : '#C3CCE6' }}>{g.name}</span>
                </div>
              ))}
              {(watch.premiereTitle || watch.premiereSubtitle) && (
                <div style={sx('margin-top:10px;padding:14px;border-radius:8px;background:#D21034;font-size:14px;line-height:1.45')}>
                  <b>{watch.premiereTitle}</b>
                  {watch.premiereTitle && watch.premiereSubtitle && <br />}
                  {watch.premiereSubtitle}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
