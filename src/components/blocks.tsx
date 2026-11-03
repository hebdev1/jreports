import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { clock, shortDate } from '../lib/format';
import { sx } from '../lib/sx';
import { LANG_NAMES, TOPIC_COVERS } from '../lib/theme';
import type { ArchiveItem, Episode } from '../lib/types';
import { canPlay, usePlayer } from './player';
import { EYEBROW } from './ui';

export const H2 = "margin:0;font-family:'Playfair Display',serif;font-size:clamp(34px,4vw,52px);font-weight:700;letter-spacing:-0.02em;line-height:1.05";
export const H1 = "margin:0 0 16px;font-family:'Playfair Display',serif;font-size:clamp(44px,6vw,84px);font-weight:700;letter-spacing:-0.03em;line-height:1";
export const UNDERLINE_BTN = 'background:none;border:0;border-bottom:1px solid #0B1F5C;padding:4px 0;font-size:15px;font-weight:600;color:#0B1F5C;cursor:pointer';

export function Triangle({ size = 11, color = '#FFFFFF', ml = 3 }: Readonly<{ size?: number; color?: string; ml?: number }>) {
  const h = Math.round(size * 0.64);
  return <span aria-hidden="true" style={{ width: 0, height: 0, marginLeft: ml, borderLeft: `${size}px solid ${color}`, borderTop: `${h}px solid transparent`, borderBottom: `${h}px solid transparent` }} />;
}

/** Eyebrow + heading + optional action on the right, as used by most sections. */
export function SectionHead({ eyebrow, title, id, action, eyebrowColor = '#D21034', mb = 36 }: Readonly<{ eyebrow: ReactNode; title: string; id?: string; action?: ReactNode; eyebrowColor?: string; mb?: number }>) {
  return (
    <div style={{ ...sx('display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap'), marginBottom: mb }}>
      <div>
        <div style={{ ...sx(EYEBROW + ';margin-bottom:10px'), color: eyebrowColor }}>{eyebrow}</div>
        <h2 id={id} style={sx(H2)}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** Click anywhere on a card to open it, except on its own links and buttons. */
function useCardClick(to: string) {
  const navigate = useNavigate();
  return (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button')) return;
    navigate(to);
  };
}

function PlayButton({ ep, css, size = 11 }: Readonly<{ ep: Episode; css: string; size?: number }>) {
  const player = usePlayer();
  if (!canPlay(ep)) return null;
  const now = player.episode?.id === ep.id && player.playing;
  return (
    <button type="button" onClick={() => (now ? player.toggle() : player.play(ep))} aria-label={`${now ? 'Pause' : 'Play'} EP ${ep.number}: ${ep.title}`} className="press h-red" style={sx(css)}>
      {now ? <span aria-hidden="true" style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 700 }}>❚❚</span> : <Triangle size={size} />}
    </button>
  );
}

/** Home page "Recent episodes" card. */
export function EpisodeCard({ ep }: Readonly<{ ep: Episode }>) {
  const open = useCardClick(`/episodes/${ep.id}`);
  return (
    <article onClick={open} className="h-lift" style={sx('cursor:pointer;display:flex;flex-direction:column;gap:14px;transition:transform 250ms ease-out')}>
      <div style={{ position: 'relative' }}>
        <div aria-hidden="true" style={{ ...sx('position:relative;aspect-ratio:16/10;border-radius:12px;overflow:hidden;padding:18px;display:flex;flex-direction:column;justify-content:space-between'), background: TOPIC_COVERS[ep.topic] }}>
          <div style={sx('display:flex;justify-content:space-between;align-items:center')}>
            <span style={sx(EYEBROW + ';color:#FFFFFF')}>EP {ep.number}</span>
            <span style={sx('font-size:11px;font-weight:600;color:#081230;background:#EEF1F8;padding:3px 7px;border-radius:4px')}>{ep.language}</span>
          </div>
          <div style={sx("font-family:'Playfair Display',serif;font-style:italic;font-size:30px;line-height:1;color:#F7F8FC;opacity:0.92")}>{ep.topic}</div>
        </div>
        <PlayButton ep={ep} css="position:absolute;right:16px;bottom:16px;width:44px;height:44px;border-radius:999px;border:0;background:#D21034;display:grid;place-items:center;cursor:pointer" />
      </div>
      <div style={sx('font-size:12px;color:#6B6B6B;display:flex;gap:8px')}>
        <span>{shortDate(ep.publishedOn)}</span>
        <span aria-hidden="true">·</span>
        <span>
          <span className="sr-only">Duration </span>
          {clock(ep.durationSeconds)}
        </span>
        <span className="sr-only">· {LANG_NAMES[ep.language]}</span>
      </div>
      <h3 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:22px;font-weight:600;line-height:1.2;text-wrap:pretty")}>
        <Link to={`/episodes/${ep.id}`} className="h-red-text" style={{ color: 'inherit' }}>
          {ep.title}
        </Link>
      </h3>
      <p style={sx('margin:0;font-size:14px;line-height:1.5;color:#4A5578')}>{ep.guest}</p>
    </article>
  );
}

/** Episodes page list row. */
export function EpisodeRow({ ep }: Readonly<{ ep: Episode }>) {
  const open = useCardClick(`/episodes/${ep.id}`);
  return (
    <article onClick={open} className="ep-row h-row" style={sx('display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr) auto;gap:28px;align-items:center;padding:24px 0;border-bottom:1px solid #E4E8F2;cursor:pointer')}>
      <div className="ep-cover" aria-hidden="true" style={{ ...sx('aspect-ratio:16/10;border-radius:12px;padding:14px;display:flex;flex-direction:column;justify-content:space-between'), background: TOPIC_COVERS[ep.topic] }}>
        <span style={sx(EYEBROW + ';color:#FFFFFF')}>EP {ep.number}</span>
        <span style={sx("font-family:'Playfair Display',serif;font-style:italic;font-size:22px;color:#F7F8FC")}>{ep.topic}</span>
      </div>
      <div style={sx('display:flex;flex-direction:column;gap:8px;min-width:0')}>
        <div style={sx('font-size:12px;color:#6B6B6B;display:flex;gap:8px;flex-wrap:wrap')}>
          <span>{shortDate(ep.publishedOn)}</span>
          <span aria-hidden="true">·</span>
          <span>{clock(ep.durationSeconds)}</span>
          <span aria-hidden="true">·</span>
          <span style={sx('font-weight:600;color:#00209F')}>{LANG_NAMES[ep.language]}</span>
        </div>
        <h3 style={sx("margin:0;font-family:'Playfair Display',serif;font-size:26px;font-weight:600;line-height:1.2;text-wrap:pretty")}>
          <Link to={`/episodes/${ep.id}`} className="h-red-text" style={{ color: 'inherit' }}>
            <span className="sr-only">EP {ep.number}: </span>
            {ep.title}
          </Link>
        </h3>
        <p style={sx('margin:0;font-size:15px;line-height:1.5;color:#4A5578;max-width:640px')}>{ep.dek}</p>
      </div>
      <ListPlay ep={ep} />
    </article>
  );
}

function ListPlay({ ep }: Readonly<{ ep: Episode }>) {
  const player = usePlayer();
  if (!canPlay(ep)) return <span />;
  const now = player.episode?.id === ep.id && player.playing;
  return (
    <button
      type="button"
      onClick={() => (now ? player.toggle() : player.play(ep))}
      aria-label={`${now ? 'Pause' : 'Play'} EP ${ep.number}: ${ep.title}`}
      className="press h-play"
      style={sx('width:56px;height:56px;border-radius:999px;border:1px solid #0B1F5C;background:transparent;display:grid;place-items:center;cursor:pointer')}
    >
      {now ? <span aria-hidden="true" style={{ fontSize: 15, fontWeight: 700 }}>❚❚</span> : <span style={sx('width:0;height:0;margin-left:3px;border-left:13px solid #0B1F5C;border-top:8px solid transparent;border-bottom:8px solid transparent')} />}
    </button>
  );
}

/** Archive tile linking out to jamespierre.com. */
export function ArchiveCard({ item }: Readonly<{ item: ArchiveItem }>) {
  const [broken, setBroken] = useState(false);
  return (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className="h-red-text" style={sx('display:flex;flex-direction:column;gap:10px;color:#0B1F5C')}>
      <div style={sx('aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#DDE3F0;display:grid;place-items:center')}>
        {broken ? (
          <span aria-hidden="true" style={sx("font-family:'Oswald',sans-serif;font-weight:700;font-size:28px;color:#8E9AC0")}>JR</span>
        ) : (
          <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" onError={() => setBroken(true)} style={sx('width:100%;height:100%;object-fit:cover;display:block')} />
        )}
      </div>
      <span style={sx("font-family:'Playfair Display',serif;font-size:18px;font-weight:600")}>
        {item.name}
        <span className="sr-only"> (opens jamespierre.com in a new tab)</span>
      </span>
      <span style={sx('font-size:13px;color:#6B6B6B')}>{item.show}</span>
    </a>
  );
}

const YT = 'https://www.youtube-nocookie.com/embed/';

export function ytPlaylist(list: string, extra = '') {
  return `${YT}videoseries?list=${list}${extra}`;
}

export function ytVideo(id: string, extra = '') {
  return `${YT}${id}${extra ? '?' + extra.replace(/^[?&]/, '') : ''}`;
}

/** A 16:9 YouTube frame (privacy-enhanced domain). */
export function YouTube({ src, title, css, lazy = true }: Readonly<{ src: string; title: string; css: string; lazy?: boolean }>) {
  return (
    <div style={sx(css)}>
      <iframe
        src={src}
        title={title}
        loading={lazy ? 'lazy' : undefined}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={sx('position:absolute;inset:0;width:100%;height:100%;border:0')}
      />
    </div>
  );
}
