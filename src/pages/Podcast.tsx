import { useState } from 'react';
import { Link } from 'react-router';
import { H2, YouTube, ytPlaylist } from '../components/blocks';
import { useOpenSubscribe } from '../components/subscribe';
import { EYEBROW, FlagBar } from '../components/ui';
import { useChannelUrl, useConfig } from '../lib/content';
import { withHandle } from '../lib/format';
import { sx } from '../lib/sx';
import { useTitle } from '../lib/useTitle';

export default function Podcast() {
  useTitle('The podcast');
  const openSubscribe = useOpenSubscribe();
  // Playlists are set in the admin (Site → Watch & podcast).
  const { podcast } = useConfig().cfg;
  const channel = useChannelUrl();
  const LISTS: Array<[string, string]> = podcast.playlists.map((p) => [p.id, p.label]);
  const [chosen, setList] = useState<string | null>(null);
  const list = chosen && LISTS.some(([id]) => id === chosen) ? chosen : (LISTS[0]?.[0] ?? podcast.uploadsPlaylistId);
  const ghost = 'border:1px solid rgba(247,248,252,0.4);color:#FFFFFF;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600';

  return (
    <div>
      <section aria-labelledby="pod-title" className="on-dark" style={sx('background:#081230;color:#FFFFFF')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:64px 32px 72px;display:flex;flex-direction:column;gap:36px')}>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px 56px;align-items:end')}>
            <div style={sx('display:flex;flex-direction:column;gap:18px')}>
              <span style={sx(EYEBROW + ';color:#FF8A9B')}>{withHandle('The podcast', channel)}</span>
              <h1 id="pod-title" style={sx("margin:0;font-family:'Oswald',sans-serif;font-weight:700;font-size:clamp(52px,7vw,104px);line-height:0.92;letter-spacing:0.01em;text-transform:uppercase")}>
                <span style={{ color: '#FFFFFF' }}>James</span>
                <br />
                <span style={{ color: '#FF8A9B' }}>Reports</span>
              </h1>
            </div>
            <div style={sx('display:flex;flex-direction:column;gap:18px;align-items:flex-start')}>
              <p style={sx("margin:0;font-family:'Lora',serif;font-size:19px;line-height:1.55;color:#C3CCE6")}>
                Exclusive interviews and in-depth reporting on immigration, politics, Haiti and the Haitian community worldwide. New episodes premiere on YouTube.
              </p>
              <div style={sx('display:flex;gap:10px;flex-wrap:wrap')}>
                <a href={channel} target="_blank" rel="noopener noreferrer" className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600')}>
                  Subscribe on YouTube
                </a>
                <a href={channel} target="_blank" rel="noopener noreferrer" className="h-white-border" style={sx(ghost)}>
                  Open channel
                </a>
                <button type="button" onClick={openSubscribe} className="press h-white-border" style={sx('background:transparent;cursor:pointer;' + ghost)}>
                  Premiere alerts
                </button>
              </div>
            </div>
          </div>
          <div role="group" aria-label="Playlist" style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
            {LISTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={list === id}
                onClick={() => setList(id)}
                className="press"
                style={{
                  ...sx('border-radius:999px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer'),
                  ...(list === id ? { background: '#FFFFFF', color: '#081230', border: '1px solid #FFFFFF' } : { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(247,248,252,0.35)' }),
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <YouTube key={list} lazy={false} src={ytPlaylist(list, '&rel=0')} title={`James Reports on YouTube — ${LISTS.find(([id]) => id === list)?.[1]}`} css="position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;background:#0B1F5C;box-shadow:0 8px 24px rgba(0,0,0,0.35)" />
          <FlagBar style={{ borderRadius: 2, overflow: 'hidden' }} />
        </div>
      </section>

      <section aria-labelledby="latest-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px')}>
        <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:32px')}>
          <div>
            <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Most recent uploads</div>
            <h2 id="latest-title" style={sx(H2)}>
              Watch the latest
            </h2>
          </div>
          <a href={channel} target="_blank" rel="noopener noreferrer" style={sx('border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:15px;font-weight:600')}>
            All videos on YouTube →
          </a>
        </div>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:24px')}>
          {[5, 6, 7, 8, 9, 10].map((i) => (
            <YouTube key={i} src={ytPlaylist(podcast.uploadsPlaylistId, `&index=${i}`)} title={`James Reports on YouTube — upload ${i}`} css="position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#DDE3F0;box-shadow:0 2px 12px rgba(0,0,0,0.07)" />
          ))}
        </div>
      </section>

      <section style={sx('background:#E6EBF8')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:64px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:32px 56px;align-items:center')}>
          <div style={sx('display:flex;flex-direction:column;gap:12px')}>
            <span style={sx(EYEBROW + ';color:#00209F')}>Keep it independent</span>
            <h2 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(30px,3.4vw,44px);font-weight:700;letter-spacing:-0.02em;line-height:1.1")}>Every episode is funded by viewers.</h2>
          </div>
          <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
            <Link to="/support" className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
              Support James Reports
            </Link>
            <Link to="/booking?tab=ads" className="press h-white-bg" style={sx('background:transparent;color:#0B1F5C;border:1px solid #0B1F5C;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
              Sponsor an episode
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
