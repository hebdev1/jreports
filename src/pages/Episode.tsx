import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Triangle, ytVideo } from '../components/blocks';
import { Img } from '../components/Img';
import { canPlay, usePlayer } from '../components/player';
import { EYEBROW, LoadError, Skeleton } from '../components/ui';
import { useEpisodes, useSettings } from '../lib/content';
import { clock, shortDate } from '../lib/format';
import { sx } from '../lib/sx';
import { LANG_NAMES, TOPIC_COVERS, YOUTUBE_CHANNEL } from '../lib/theme';
import type { Episode as Ep } from '../lib/types';
import { useTitle } from '../lib/useTitle';
import NotFound from './NotFound';

export default function Episode() {
  const { id } = useParams();
  const episodes = useEpisodes();
  const ep = episodes.status === 'ready' ? episodes.data.find((e) => e.id === id) : undefined;
  useTitle(ep ? `EP ${ep.number}: ${ep.title}` : 'Episode');

  if (episodes.status === 'loading')
    return (
      <section className="on-dark wrap" aria-busy="true" style={sx('background:#081230;padding:40px 32px 64px')}>
        <div style={sx('max-width:1320px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:48px')}>
          <Skeleton count={1} css="aspect-ratio:16/9" />
          <Skeleton count={3} css="height:64px" />
        </div>
      </section>
    );
  if (episodes.status === 'error')
    return (
      <section className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px')}>
        <LoadError message="We couldn’t load this episode." onRetry={episodes.retry} />
      </section>
    );
  if (!ep) return <NotFound what="episode" />;
  return <EpisodeView key={ep.id} ep={ep} />;
}

function EpisodeView({ ep }: Readonly<{ ep: Ep }>) {
  const player = usePlayer();
  const settings = useSettings();
  const [watchingFrom, setWatchingFrom] = useState<number | null>(null);
  const [share, setShare] = useState<'idle' | 'copied' | 'failed'>('idle');
  const hasAudio = canPlay(ep);
  const hasVideo = Boolean(ep.youtubeId);
  const supporters = settings.status === 'ready' ? settings.data.supportersCount : null;

  useEffect(() => {
    if (share === 'idle') return;
    const t = setTimeout(() => setShare('idle'), 4000);
    return () => clearTimeout(t);
  }, [share]);

  const startPlayback = (at = 0) => {
    if (hasVideo) setWatchingFrom(at);
    else if (hasAudio) player.play(ep, at);
  };

  const onShare = async () => {
    const url = `${window.location.origin}/episodes/${ep.id}`;
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: ep.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShare('copied');
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') setShare('failed');
    }
  };

  const ghost = 'border:1px solid rgba(247,248,252,0.4);color:#F7F8FC;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600';
  const youtubeHref = ep.youtubeId ? `https://www.youtube.com/watch?v=${ep.youtubeId}` : YOUTUBE_CHANNEL;

  return (
    <div>
      <section aria-labelledby="ep-title" className="on-dark" style={sx('background:#081230;color:#F7F8FC')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:40px 32px 64px')}>
          <Link to="/episodes" className="h-white-text" style={sx('display:inline-block;background:none;border:0;color:#C3CCE6;font-size:14px;cursor:pointer;padding:0;margin-bottom:28px')}>
            ← All episodes
          </Link>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:48px;align-items:start')}>
            <div style={{ ...sx('position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;display:grid;place-items:center'), background: TOPIC_COVERS[ep.topic] }}>
              {watchingFrom !== null && ep.youtubeId ? (
                <iframe
                  src={ytVideo(ep.youtubeId, `autoplay=1&rel=0&start=${watchingFrom}`)}
                  title={`EP ${ep.number}: ${ep.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  style={sx('position:absolute;inset:0;width:100%;height:100%;border:0')}
                />
              ) : (
                <>
                  <Img src="keyart.png" alt="" eager sizes="(max-width: 1100px) 100vw, 640px" />
                  {(hasVideo || hasAudio) && (
                    <button type="button" onClick={() => startPlayback()} aria-label={hasVideo ? `Watch EP ${ep.number}` : `Listen to EP ${ep.number}`} className="press h-red" style={sx('position:absolute;width:84px;height:84px;border-radius:999px;border:0;background:#D21034;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.3)')}>
                      <Triangle size={22} ml={5} />
                    </button>
                  )}
                  <span style={sx(EYEBROW + ';position:absolute;left:16px;top:16px;background:rgba(8,18,48,0.8);color:#FF8A9B;padding:6px 10px;border-radius:4px')}>
                    EP {ep.number} · {clock(ep.durationSeconds)}
                  </span>
                </>
              )}
            </div>
            <div style={sx('display:flex;flex-direction:column;gap:20px')}>
              <div style={sx('display:flex;gap:10px;flex-wrap:wrap')}>
                <span style={sx(EYEBROW + ';color:#081230;background:#C9D3F2;padding:5px 9px;border-radius:4px')}>{ep.topic}</span>
                <span style={sx(EYEBROW + ';color:#081230;background:#EEF1F8;padding:5px 9px;border-radius:4px')}>{LANG_NAMES[ep.language]}</span>
              </div>
              <h1 id="ep-title" style={sx("margin:0;font-family:'Playfair Display',serif;font-size:clamp(36px,4.2vw,58px);font-weight:700;letter-spacing:-0.02em;line-height:1.05;text-wrap:balance")}>
                {ep.title}
              </h1>
              <p style={sx("margin:0;font-family:'Lora',serif;font-size:18px;line-height:1.6;color:#DDE3F0")}>{ep.dek}</p>
              <div style={sx('font-size:14px;color:#C3CCE6')}>
                {ep.guest} · {shortDate(ep.publishedOn)}
              </div>
              <div style={sx('display:flex;gap:10px;flex-wrap:wrap')}>
                {hasAudio && (
                  <button type="button" onClick={() => player.play(ep)} className="press h-red" style={sx('background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600;cursor:pointer')}>
                    Listen · audio
                  </button>
                )}
                <a href={youtubeHref} target="_blank" rel="noopener noreferrer" className={hasAudio ? 'h-pink' : 'press h-red'} style={sx(hasAudio ? ghost : 'background:#D21034;color:#FFFFFF;border-radius:999px;padding:14px 22px;font-size:14px;font-weight:600')}>
                  Watch on YouTube
                </a>
                <button type="button" onClick={onShare} className="press h-pink" style={sx('background:transparent;cursor:pointer;' + ghost)}>
                  {share === 'copied' ? 'Link copied' : 'Share'}
                </button>
              </div>
              <span role="status" style={sx('font-size:13px;color:#FFD1D8;min-height:1em')}>
                {share === 'failed' ? 'Couldn’t copy the link. You can copy it from the address bar.' : share === 'copied' ? <span className="sr-only">Link copied to clipboard</span> : ''}
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:64px 32px 96px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:56px')}>
        <div>
          <h2 style={sx("margin:0 0 20px;font-family:'Playfair Display',serif;font-size:30px;font-weight:700")}>Chapters</h2>
          {ep.chapters.length === 0 ? (
            <p style={sx('margin:0;font-size:16px;line-height:1.6;color:#4A5578;border-top:1px solid #E4E8F2;padding-top:16px')}>Chapters for this episode haven’t been posted yet.</p>
          ) : (
            <ol style={sx('display:flex;flex-direction:column;list-style:none;margin:0;padding:0')}>
              {ep.chapters.map((ch) => {
                const row = 'display:grid;grid-template-columns:72px 1fr;gap:16px;text-align:left;background:none;border:0;border-top:1px solid #E4E8F2;padding:16px 0;color:#0B1F5C;width:100%';
                const inner = (
                  <>
                    <span style={sx('font-variant-numeric:tabular-nums;font-weight:600;color:#D21034')}>{clock(ch.at)}</span>
                    <span style={{ fontSize: 16 }}>{ch.label}</span>
                  </>
                );
                return (
                  <li key={ch.at}>
                    {hasVideo || hasAudio ? (
                      <button type="button" onClick={() => startPlayback(ch.at)} className="h-red-text" style={sx(row + ';cursor:pointer;font-size:16px')}>
                        {inner}
                        <span className="sr-only"> — play from here</span>
                      </button>
                    ) : (
                      <div style={sx(row)}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div style={sx('display:flex;flex-direction:column;gap:24px')}>
          <div style={sx('background:#FFFFFF;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.07);padding:28px;display:flex;flex-direction:column;gap:12px')}>
            <h2 style={sx(EYEBROW + ';margin:0;color:#6B6B6B')}>Transcript</h2>
            <p style={sx('margin:0;font-size:15px;line-height:1.6;color:#4A5578')}>Full transcripts are published with every episode in English, French, Haitian Creole and Spanish.</p>
            <ul style={sx('display:flex;gap:8px;flex-wrap:wrap;list-style:none;margin:0;padding:0')}>
              {['English', 'Français', 'Kreyòl', 'Español'].map((l) => (
                <li key={l} style={sx('border:1px solid #CDD4E6;border-radius:999px;padding:6px 12px;font-size:13px')}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="on-dark" style={sx('background:#0B1F5C;color:#F7F8FC;border-radius:12px;padding:28px;display:flex;flex-direction:column;gap:14px')}>
            <h2 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:24px;font-weight:700")}>Made possible by viewers like you</h2>
            <p style={sx('margin:0;font-size:15px;line-height:1.55;color:#C3CCE6')}>
              {supporters !== null ? `This episode was funded by ${supporters.toLocaleString('en-US')} monthly supporters.` : 'This episode was funded by monthly supporters like you.'}
            </p>
            <Link to="/support" className="press h-red" style={sx('align-self:flex-start;background:#D21034;color:#FFFFFF;border:0;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer')}>
              Become a supporter
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
