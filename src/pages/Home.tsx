import { Link, useNavigate } from 'react-router';
import { ArchiveCard, EpisodeCard, H2, SectionHead, Triangle, UNDERLINE_BTN, YouTube, ytPlaylist, ytVideo } from '../components/blocks';
import { Img } from '../components/Img';
import { canPlay, usePlayer } from '../components/player';
import { EYEBROW, LoadError, Skeleton } from '../components/ui';
import { useArchive, useEpisodes, useReports, useSettings } from '../lib/content';
import { clock, money } from '../lib/format';
import { sx } from '../lib/sx';
import { YOUTUBE_CHANNEL, YT_UPLOADS } from '../lib/theme';
import { useTitle } from '../lib/useTitle';

const OUTLETS = ['CNN en Español', 'MSNBC', 'NewsNation', 'Univision', 'Telemundo', 'NBC 6', 'CBS 4', 'PBS'];
const TIMELINE = [
  ['2004', 'Protests in Haiti that forced President Aristide into exile'],
  ['2010', 'The earthquake that struck Haiti, and the cholera outbreak that followed'],
  ['2017', 'TPS for Haitians'],
  ['2021', 'Arrest of former Panamanian president Ricardo Martinelli'],
  ['Now', 'James Reports: independent interviews and reporting'],
];

export default function Home() {
  useTitle(null);
  return (
    <div>
      <Hero />
      <section aria-label="Media appearances" style={sx('border-bottom:1px solid #E4E8F2;background:#FFFFFF')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:22px 32px;display:flex;gap:36px;align-items:center;flex-wrap:wrap')}>
          <span style={sx(EYEBROW + ';color:#6B6B6B')}>James has appeared on</span>
          <ul style={sx('display:flex;gap:32px;flex-wrap:wrap;align-items:center;flex:1;list-style:none;margin:0;padding:0')}>
            {OUTLETS.map((o) => (
              <li key={o} style={sx("font-family:'Playfair Display',serif;font-weight:700;font-size:18px;color:#4A5578;letter-spacing:-0.01em")}>
                {o}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Story />
      <RecentEpisodes />
      <LatestOnYouTube />
      <ReportsAndHistory />
      <Fundraising />
      <ArchivePreview />
      <SponsorAd />
      <SponsorThanks />
    </div>
  );
}

function Hero() {
  const episodes = useEpisodes();
  const player = usePlayer();
  const navigate = useNavigate();
  const hero = episodes.status === 'ready' ? episodes.data[0] : undefined;

  return (
    <section aria-labelledby="hero-title" className="on-dark" style={sx('background:#081230;color:#F7F8FC;overflow:hidden')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px 80px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:56px;align-items:center')}>
        <div style={sx('display:flex;flex-direction:column;gap:28px')}>
          {episodes.status === 'loading' && (
            <div aria-busy="true" aria-label="Loading the latest episode" style={sx('display:flex;flex-direction:column;gap:20px')}>
              <Skeleton count={1} css="height:22px;width:200px" />
              <Skeleton count={3} css="height:72px;width:100%" />
              <Skeleton count={1} css="height:60px;width:80%" />
              <h1 id="hero-title" className="sr-only">James Reports</h1>
            </div>
          )}
          {episodes.status === 'error' && (
            <>
              <h1 id="hero-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(44px,6.2vw,88px);line-height:0.98;letter-spacing:-0.03em")}>James Reports</h1>
              <LoadError dark message="We couldn’t load the latest episode." onRetry={episodes.retry} />
            </>
          )}
          {episodes.status === 'ready' && !hero && (
            <>
              <h1 id="hero-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(44px,6.2vw,88px);line-height:0.98;letter-spacing:-0.03em")}>James Reports</h1>
              <p style={sx("margin:0;font-family:'Lora',serif;font-size:20px;line-height:1.55;color:#DDE3F0;max-width:560px")}>New episodes are on the way. Subscribe on YouTube so you don’t miss the next premiere.</p>
            </>
          )}
          {hero && (
            <>
              <div style={sx('display:flex;gap:12px;align-items:center;flex-wrap:wrap')}>
                <span style={sx(EYEBROW + ';color:#FFFFFF;background:#D21034;padding:6px 10px;border-radius:4px')}>Latest episode</span>
                <span style={sx(EYEBROW + ';color:#C9D3F2')}>
                  {hero.topic} · {clock(hero.durationSeconds)}
                </span>
              </div>
              <h1 id="hero-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(44px,6.2vw,88px);line-height:0.98;letter-spacing:-0.03em;text-wrap:balance")}>
                {hero.title}
              </h1>
              <p style={sx("margin:0;font-family:'Lora',serif;font-size:20px;line-height:1.55;color:#DDE3F0;max-width:560px;text-wrap:pretty")}>{hero.dek}</p>
              <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
                {canPlay(hero) && (
                  <button type="button" onClick={() => player.play(hero)} className="press h-red" style={sx('display:flex;align-items:center;gap:10px;background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')}>
                    <Triangle ml={0} /> Listen now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/episodes/${hero.id}`)}
                  className={canPlay(hero) ? 'press h-pink' : 'press h-red'}
                  style={
                    canPlay(hero)
                      ? sx('background:transparent;color:#F7F8FC;border:1px solid rgba(247,248,252,0.4);border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')
                      : sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px 26px;font-size:15px;font-weight:600;cursor:pointer')
                  }
                >
                  Watch the interview
                </button>
              </div>
            </>
          )}
          <dl style={sx('display:flex;gap:40px;flex-wrap:wrap;padding-top:28px;border-top:1px solid rgba(247,248,252,0.14);margin:0')}>
            {[
              ['4×', 'Emmy Award winner'],
              ['20+', 'Years in broadcast'],
              ['4', 'Languages · EN FR KR ES'],
            ].map(([n, l]) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column-reverse' }}>
                <dt style={sx('font-size:13px;color:#C3CCE6;margin-top:6px')}>{l}</dt>
                <dd style={sx("margin:0;font-family:'Playfair Display',serif;font-size:40px;font-weight:700;color:#FF8A9B;line-height:1")}>{n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={sx('position:relative;width:100%;aspect-ratio:4/5;border-radius:20px;overflow:hidden;background:#0B1F5C')}>
            <Img src="hero-james.webp" alt="James Pierre holding his Emmy award in front of the Suncoast Emmy Awards backdrop" eager sizes="(max-width: 960px) 100vw, 620px" />
          </div>
          <div className="host-card" style={sx('position:absolute;left:-20px;bottom:32px;background:#FFFFFF;color:#0B1F5C;border-radius:12px;padding:16px 20px;box-shadow:0 8px 24px rgba(0,0,0,0.25);display:flex;flex-direction:column;gap:4px;max-width:260px')}>
            <span style={sx(EYEBROW + ';color:#D21034')}>Host</span>
            <span style={sx("font-family:'Playfair Display',serif;font-size:20px;font-weight:700")}>James Pierre</span>
            <span style={sx("font-family:'Lora',serif;font-style:italic;font-size:14px;color:#4A5578")}>Haitian-American journalist, anchor and producer</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section aria-labelledby="story-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px 0')}>
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:40px 56px;align-items:center')}>
        <div style={sx('display:flex;flex-direction:column;gap:18px')}>
          <span style={sx(EYEBROW + ';color:#D21034')}>Our story</span>
          <h2 id="story-title" style={sx(H2 + ';text-wrap:balance')}>
            How James Reports began
          </h2>
          <p style={sx("margin:0;font-family:'Lora',serif;font-size:18px;line-height:1.6;color:#4A5578")}>James tells the story of why he created James Reports and what the channel stands for.</p>
          <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
            <Link to="/watch" className="press h-navy" style={sx('background:#0B1F5C;color:#FFFFFF;border:0;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
              Watch James Reports TV
            </Link>
            <Link to="/about" style={sx('background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer;align-self:center')}>
              About James →
            </Link>
          </div>
        </div>
        <YouTube src={ytVideo('Q_oljAV4Yfs', 'start=31&rel=0')} title="The story of James Reports" css="position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;background:#081230;box-shadow:0 8px 24px rgba(0,0,0,0.11)" />
      </div>
    </section>
  );
}

function RecentEpisodes() {
  const episodes = useEpisodes();
  return (
    <section aria-labelledby="recent-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px 40px')}>
      <SectionHead
        eyebrow="The interviews"
        title="Recent episodes"
        id="recent-title"
        action={
          <Link to="/episodes" style={sx(UNDERLINE_BTN)}>
            All episodes →
          </Link>
        }
      />
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:24px')}>
        {episodes.status === 'loading' && <Skeleton count={4} css="aspect-ratio:16/14" />}
        {episodes.status === 'error' && <LoadError message="We couldn’t load the latest episodes." onRetry={episodes.retry} />}
        {episodes.status === 'ready' && episodes.data.length <= 1 && <p style={sx('margin:0;color:#4A5578;font-size:16px')}>More episodes are coming soon.</p>}
        {episodes.status === 'ready' && episodes.data.slice(1, 5).map((ep) => <EpisodeCard key={ep.id} ep={ep} />)}
      </div>
    </section>
  );
}

function LatestOnYouTube() {
  const navigate = useNavigate();
  return (
    <section aria-labelledby="yt-title" className="on-dark" style={sx('background:#081230;color:#FFFFFF')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px')}>
        <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;margin-bottom:36px')}>
          <div>
            <div style={sx(EYEBROW + ';display:flex;align-items:center;gap:10px;color:#FF8A9B;margin-bottom:10px')}>
              <span aria-hidden="true" style={sx('width:22px;height:16px;border-radius:4px;background:#D21034;display:grid;place-items:center')}>
                <Triangle size={6} ml={2} />
              </span>
              Live from YouTube
            </div>
            <h2 id="yt-title" style={sx(H2)}>
              Latest on the podcast
            </h2>
          </div>
          <div style={sx('display:flex;gap:12px;flex-wrap:wrap;align-items:center')}>
            <a href={YOUTUBE_CHANNEL} target="_blank" rel="noopener noreferrer" className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600')}>
              Subscribe on YouTube
            </a>
            <Link to="/podcast" className="h-pink-text" style={sx('background:none;border:0;border-bottom:1px solid #FFFFFF;padding:4px 0;font-size:15px;font-weight:600;color:#FFFFFF;cursor:pointer')}>
              Open the podcast →
            </Link>
          </div>
        </div>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:24px')}>
          {[1, 2, 3, 4].map((i) => {
            const label = i === 1 ? 'Newest upload' : `Upload ${i}`;
            return (
              <article key={i} style={sx('display:flex;flex-direction:column;gap:14px')}>
                <YouTube src={ytPlaylist(YT_UPLOADS, `&index=${i}`)} title={`James Reports on YouTube — ${label}`} css="position:relative;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#0B1F5C" />
                <div style={sx('display:flex;justify-content:space-between;gap:12px;align-items:center')}>
                  <span style={sx(EYEBROW + ';color:#FF8A9B')}>{label}</span>
                  <button type="button" onClick={() => navigate('/podcast')} className="h-white-text" style={sx('background:none;border:0;padding:0;font-size:13px;font-weight:600;color:#C3CCE6;cursor:pointer')}>
                    Watch on site →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReportsAndHistory() {
  const reports = useReports();
  return (
    <section className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px 88px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:56px')}>
      <div>
        <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Reports</div>
        <h2 style={sx(H2 + ';margin:0 0 28px')}>On the record</h2>
        <div style={sx('display:flex;flex-direction:column')}>
          {reports.status === 'loading' && <Skeleton count={4} css="height:96px;margin-top:12px" />}
          {reports.status === 'error' && <LoadError message="We couldn’t load the latest reports." onRetry={reports.retry} />}
          {reports.status === 'ready' && reports.data.length === 0 && <p style={sx('color:#4A5578')}>Reports are coming soon.</p>}
          {reports.status === 'ready' &&
            reports.data.slice(0, 4).map((r, i) => (
              <Link key={r.id} to="/reports" className="h-red-text" style={sx('text-align:left;background:none;border:0;border-top:1px solid #CDD4E6;padding:22px 0;display:grid;grid-template-columns:auto 1fr;gap:20px;cursor:pointer;color:#0B1F5C')}>
                <span aria-hidden="true" style={sx("font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:#D21034;line-height:1;min-width:40px")}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={sx('display:flex;flex-direction:column;gap:6px')}>
                  <span style={sx(EYEBROW + ';color:#D21034')}>{r.topic}</span>
                  <span style={sx("font-family:'Playfair Display',serif;font-size:22px;font-weight:600;line-height:1.25")}>{r.title}</span>
                  <span style={sx('font-size:13px;color:#6B6B6B')}>{r.readMinutes} min read</span>
                </span>
              </Link>
            ))}
        </div>
      </div>
      <div className="card-pad" style={sx('background:#E6EBF8;border-radius:20px;padding:40px;display:flex;flex-direction:column;gap:20px;align-self:start')}>
        <div style={sx(EYEBROW + ';color:#00209F')}>Coverage history</div>
        <p style={sx("margin:0;font-family:'Lora',serif;font-size:22px;line-height:1.5;color:#0B1F5C;text-wrap:pretty")}>Two decades on the biggest stories in Haiti and South Florida.</p>
        <dl style={sx('display:flex;flex-direction:column;gap:0;margin:0')}>
          {TIMELINE.map(([y, e]) => (
            <div key={y} style={sx('display:grid;grid-template-columns:64px 1fr;gap:16px;padding:14px 0;border-top:1px solid #C9D3F2')}>
              <dt style={sx("font-family:'Playfair Display',serif;font-weight:700;font-size:18px;color:#00209F")}>{y}</dt>
              <dd style={sx('margin:0;font-size:15px;line-height:1.45;color:#0B1F5C')}>{e}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Fundraising() {
  const settings = useSettings();
  const s = settings.status === 'ready' ? settings.data : null;
  const goal = s?.monthlyGoalCents ?? null;
  const raised = s?.raisedCents ?? null;
  const supporters = s?.supportersCount ?? null;

  return (
    <section aria-labelledby="fund-title" className="on-dark" style={sx('background:#00209F')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:80px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:48px;align-items:center')}>
        <div style={sx('display:flex;flex-direction:column;gap:20px')}>
          <div style={sx(EYEBROW + ';color:#FFFFFF;opacity:0.85')}>Independent journalism</div>
          <h2 id="fund-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(38px,5vw,68px);font-weight:700;letter-spacing:-0.03em;line-height:1;color:#FFFFFF;text-wrap:balance")}>
            No network. No owners. Funded by viewers.
          </h2>
          <p style={sx('margin:0;font-size:17px;line-height:1.6;color:#E6EBF8;max-width:520px')}>James Reports is produced independently. Your support pays for field reporting, travel to Haiti, translation and production.</p>
        </div>
        <div className="card-pad" style={sx('background:#081230;color:#F7F8FC;border-radius:20px;padding:32px;display:flex;flex-direction:column;gap:20px')}>
          {raised !== null && goal ? (
            <>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap')}>
                <span style={sx("font-family:'Playfair Display',serif;font-size:36px;font-weight:700;color:#FF8A9B")}>{money(raised)}</span>
                <span style={sx('font-size:14px;color:#C3CCE6')}>of {money(goal)} monthly goal</span>
              </div>
              <div role="progressbar" aria-label="Monthly goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (raised / goal) * 100))} style={sx('height:8px;border-radius:999px;background:rgba(247,248,252,0.12);overflow:hidden')}>
                <div style={{ height: '100%', width: `${Math.min(100, (raised / goal) * 100)}%`, background: '#D21034', borderRadius: 999 }} />
              </div>
            </>
          ) : goal ? (
            <span style={sx("font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#FF8A9B;line-height:1.2")}>Help us reach our {money(goal)} monthly goal.</span>
          ) : (
            <span style={sx("font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:#FF8A9B;line-height:1.2")}>Every gift funds the next episode.</span>
          )}
          {supporters !== null && <div style={sx('font-size:14px;color:#C3CCE6')}>{supporters.toLocaleString('en-US')} monthly supporters</div>}
          <div role="group" aria-label="Quick gift amounts" style={sx('display:grid;grid-template-columns:repeat(4,1fr);gap:8px')}>
            {[10, 25, 50, 100].map((v) => (
              <Link key={v} to={`/support?amount=${v}`} className="press h-pink" style={sx('padding:14px 0;border-radius:8px;border:1px solid rgba(247,248,252,0.25);background:transparent;color:#F7F8FC;font-size:16px;font-weight:600;cursor:pointer;text-align:center')}>
                ${v}
              </Link>
            ))}
          </div>
          <Link to="/support" className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:16px;font-size:15px;font-weight:600;cursor:pointer;text-align:center')}>
            Support James Reports
          </Link>
        </div>
      </div>
    </section>
  );
}

function ArchivePreview() {
  const archive = useArchive();
  return (
    <section aria-labelledby="arch-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:88px 32px')}>
      <SectionHead
        eyebrow="From the archive"
        title="One-on-one conversations"
        id="arch-title"
        action={
          <Link to="/archive" style={sx(UNDERLINE_BTN)}>
            Browse 100+ interviews →
          </Link>
        }
      />
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:20px')}>
        {archive.status === 'loading' && <Skeleton count={5} css="aspect-ratio:4/4" />}
        {archive.status === 'error' && <LoadError message="We couldn’t load the archive." onRetry={archive.retry} />}
        {archive.status === 'ready' && archive.data.slice(0, 5).map((a) => <ArchiveCard key={a.id} item={a} />)}
      </div>
    </section>
  );
}

function SponsorAd() {
  return (
    <section aria-labelledby="sponsor-title" className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:0 32px 88px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px')}>
        <div>
          <div style={sx(EYEBROW + ';color:#D21034;margin-bottom:10px')}>Our sponsors</div>
          <h2 id="sponsor-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(28px,3vw,40px);font-weight:700;letter-spacing:-0.02em;line-height:1.1")}>
            James Reports is made possible by
          </h2>
        </div>
        <Link to="/booking?tab=ads" style={sx('background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:14px;font-weight:600;color:#0B1F5C;cursor:pointer')}>
          Become a sponsor →
        </Link>
      </div>
      <div className="on-dark" style={sx('border-radius:20px;overflow:hidden;background:#050B22;box-shadow:0 8px 24px rgba(0,0,0,0.11)')}>
        <a href="https://www.fowennursesllc.com" target="_blank" rel="noopener noreferrer" style={sx('display:block;position:relative;aspect-ratio:3162/1796;background:#050B22')}>
          <Img src="sponsor-fowennurses.png" alt="FowenNurses — Pass your NCLEX with confidence. Kraze Bèt ou, Kwè nan Tèt ou. 2,300+ nurses trained." sizes="(max-width: 1320px) 100vw, 1256px" />
          <span style={sx('position:absolute;right:16px;top:16px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#FFFFFF;background:rgba(5,11,34,0.7);border:1px solid rgba(247,248,252,0.3);padding:5px 9px;border-radius:4px')}>Sponsor</span>
          <span className="sr-only"> (opens fowennursesllc.com in a new tab)</span>
        </a>
        <div style={sx('display:flex;align-items:center;gap:16px 28px;flex-wrap:wrap;padding:22px 28px;background:#081230;color:#FFFFFF')}>
          <div style={sx('display:flex;flex-direction:column;gap:4px;flex:1;min-width:220px')}>
            <span style={sx("font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase")}>FowenNurses</span>
            <span style={sx('font-size:14px;color:#C3CCE6')}>NCLEX preparation · 2,300+ nurses trained</span>
          </div>
          <a href="tel:+17328223518" className="h-pink-text" style={sx('color:#FFFFFF;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums')}>
            (732) 822-3518
          </a>
          <a href="https://www.fowennursesllc.com" target="_blank" rel="noopener noreferrer" className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600')}>
            Visit fowennursesllc.com
          </a>
        </div>
      </div>
    </section>
  );
}

function SponsorThanks() {
  return (
    <section aria-label="Thank you to our sponsor" style={sx('background:#FFFFFF;border-top:1px solid #E4E8F2')}>
      <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:64px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:40px 56px;align-items:center')}>
        <div style={sx('display:flex;flex-direction:column;gap:18px')}>
          <span style={sx(EYEBROW + ';color:#D21034')}>Our sponsors</span>
          <span style={sx("font-family:'Oswald',sans-serif;font-size:clamp(44px,5.4vw,72px);font-weight:700;letter-spacing:0.01em;line-height:0.95;color:#0B1F5C")}>
            Fowen<span style={{ color: '#D21034' }}>Nurses</span>
          </span>
          <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578;max-width:480px')}>Thank you to FowenNurses for supporting James Reports and independent journalism for the Haitian community.</p>
          <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
            <Link to="/booking?tab=ads" className="press h-navy" style={sx('background:#0B1F5C;color:#FFFFFF;border:0;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
              Become a sponsor
            </Link>
          </div>
        </div>
        <div style={sx('position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;background:#DDE3F0')}>
          <Img src="event-fowen-group.jpg" alt="FowenNurses graduates and guests in blue on the dance floor at the FowenNurses gala" sizes="(max-width: 960px) 100vw, 620px" />
        </div>
      </div>
    </section>
  );
}
