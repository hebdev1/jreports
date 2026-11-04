import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Triangle, ytVideo } from '../components/blocks';
import { MediaImg } from '../components/Img';
import { canPlay, usePlayer } from '../components/player';
import { PreviewBanner, previewLabel, SignInToPreview, usePreviewNoindex } from '../components/PreviewParts';
import { EYEBROW, LoadError, Skeleton } from '../components/ui';
import { toApiError, type ApiError } from '../lib/api';
import { useChannelUrl, useConfig, useEpisodes } from '../lib/content';
import { clock, shortDate } from '../lib/format';
import { fetchEpisodePreview, type EpisodePreview } from '../lib/preview';
import { sx } from '../lib/sx';
import { LANG_NAMES, TOPIC_COVERS } from '../lib/theme';
import type { Episode as Ep } from '../lib/types';
import { useTitle } from '../lib/useTitle';
import NotFound from './NotFound';

const episodeTitle = (ep: Ep | undefined) => (ep ? ep.seoTitle || `EP ${ep.number}: ${ep.title}` : 'Episode');

function Loading() {
  return (
    <section className="on-dark wrap" aria-busy="true" style={sx('background:#081230;padding:40px 32px 64px')}>
      <div style={sx('max-width:1320px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:48px')}>
        <Skeleton count={1} css="aspect-ratio:16/9" />
        <Skeleton count={3} css="height:64px" />
      </div>
    </section>
  );
}

export default function Episode() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (params.get('preview') === '1' && id) return <Preview id={id} />;
  return <Published id={id} />;
}

function Published({ id }: Readonly<{ id: string | undefined }>) {
  const episodes = useEpisodes();
  const ep = episodes.status === 'ready' ? episodes.data.find((e) => e.id === id) : undefined;
  useTitle(episodeTitle(ep), ep ? ep.seoDescription || ep.dek : undefined);

  if (episodes.status === 'loading') return <Loading />;
  if (episodes.status === 'error')
    return (
      <section className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px')}>
        <LoadError message="We couldn’t load this episode." onRetry={episodes.retry} />
      </section>
    );
  if (!ep) return <NotFound what="episode" />;
  return <EpisodeView key={ep.id} ep={ep} />;
}

/** /episodes/:id?preview=1, for the team: drafts and pending edits, never indexed. */
function Preview({ id }: Readonly<{ id: string }>) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'done'; result: EpisodePreview }>({ status: 'loading' });
  const load = useCallback(() => {
    setState({ status: 'loading' });
    fetchEpisodePreview(id).then(
      (result) => setState({ status: 'done', result }),
      (err) => setState({ status: 'error', error: toApiError(err) }),
    );
  }, [id]);
  useEffect(load, [load]);
  usePreviewNoindex();
  const ep = state.status === 'done' && state.result.status === 'ok' ? state.result.item : undefined;
  useTitle(ep ? `Preview · ${episodeTitle(ep)}` : 'Preview');

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error')
    return (
      <section className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:72px 32px')}>
        <LoadError message={state.error.message} onRetry={load} />
      </section>
    );
  const r = state.result;
  if (r.status === 'not_found') return <NotFound what="episode" />;
  if (r.status === 'signed_out') return <SignInToPreview what="episodes" />;
  return <EpisodeView key={r.item.id} ep={r.item} banner={<PreviewBanner label={previewLabel(r.publication, r.hasChanges, 'episode')} editorHref={`/admin/episodes/${encodeURIComponent(r.item.id)}`} />} />;
}

function EpisodeView({ ep, banner }: Readonly<{ ep: Ep; banner?: ReactNode }>) {
  const player = usePlayer();
  const { cfg, status, slot } = useConfig();
  const channel = useChannelUrl();
  const [watchingFrom, setWatchingFrom] = useState<number | null>(null);
  const [share, setShare] = useState<'idle' | 'copied' | 'failed'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAudio = canPlay(ep);
  const hasVideo = Boolean(ep.video || ep.youtubeId);
  const poster = ep.image ?? slot('episodeDefault');
  const supporters = status === 'ready' ? cfg.fundraising.supportersCount : null;

  useEffect(() => {
    if (share === 'idle') return;
    const t = setTimeout(() => setShare('idle'), 4000);
    return () => clearTimeout(t);
  }, [share]);

  const startPlayback = (at = 0) => {
    // An uploaded video that is already open just jumps to the chapter.
    if (ep.video && videoRef.current) {
      videoRef.current.currentTime = at;
      void videoRef.current.play().catch(() => undefined);
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (hasVideo) setWatchingFrom(at);
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
  const youtubeHref = ep.youtubeId ? `https://www.youtube.com/watch?v=${ep.youtubeId}` : channel;

  return (
    <div>
      {banner}
      <section aria-labelledby="ep-title" className="on-dark" style={sx('background:#081230;color:#F7F8FC')}>
        <div className="wrap" style={sx('max-width:1320px;margin:0 auto;padding:40px 32px 64px')}>
          <Link to="/episodes" className="h-white-text" style={sx('display:inline-block;background:none;border:0;color:#C3CCE6;font-size:14px;cursor:pointer;padding:0;margin-bottom:28px')}>
            ← All episodes
          </Link>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:48px;align-items:start')}>
            <div style={{ ...sx('position:relative;aspect-ratio:16/9;border-radius:20px;overflow:hidden;display:grid;place-items:center'), background: TOPIC_COVERS[ep.topic] }}>
              {watchingFrom !== null && ep.video ? (
                <video
                  ref={videoRef}
                  src={ep.video.url}
                  poster={poster?.url}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  aria-label={`EP ${ep.number}: ${ep.title}`}
                  onLoadedMetadata={(e) => {
                    if (watchingFrom) e.currentTarget.currentTime = watchingFrom;
                  }}
                  style={sx('position:absolute;inset:0;width:100%;height:100%;background:#000;object-fit:contain')}
                />
              ) : watchingFrom !== null && ep.youtubeId ? (
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
                  <MediaImg media={poster} fallback="keyart.png" alt="" eager sizes="(max-width: 1100px) 100vw, 640px" />
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
