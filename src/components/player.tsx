import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { clock } from '../lib/format';
import type { Episode } from '../lib/types';

interface PlayerApi {
  episode: Episode | null;
  playing: boolean;
  time: number;
  duration: number;
  speed: number;
  buffering: boolean;
  error: string | null;
  play: (ep: Episode, at?: number) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  cycleSpeed: () => void;
  close: () => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}

/** An episode can only be played on the site when it has an audio file. */
export const canPlay = (ep: Episode | null | undefined): ep is Episode => Boolean(ep?.audioUrl);

const SPEEDS = [1, 1.5, 2];

/**
 * Real audio playback for the design's mini player (the design advanced a
 * timer with no audio behind it). One <audio> element for the whole site so
 * playback continues across page changes.
 */
export function PlayerProvider({ children }: Readonly<{ children: ReactNode }>) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const el = useCallback(() => {
    if (!audio.current) {
      const a = new Audio();
      a.preload = 'metadata';
      a.addEventListener('timeupdate', () => setTime(a.currentTime));
      a.addEventListener('durationchange', () => setDuration(Number.isFinite(a.duration) ? a.duration : 0));
      a.addEventListener('play', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('ended', () => setPlaying(false));
      a.addEventListener('waiting', () => setBuffering(true));
      a.addEventListener('playing', () => setBuffering(false));
      a.addEventListener('canplay', () => setBuffering(false));
      a.addEventListener('error', () => {
        setBuffering(false);
        setPlaying(false);
        setError('This episode’s audio couldn’t load. Check your connection and press play to try again.');
      });
      audio.current = a;
    }
    return audio.current;
  }, []);

  useEffect(() => () => audio.current?.pause(), []);

  const start = useCallback((a: HTMLAudioElement) => {
    setError(null);
    a.play().catch((err: unknown) => {
      // AbortError: a newer play()/load() replaced this one; nothing to report.
      if ((err as { name?: string })?.name === 'AbortError') return;
      setPlaying(false);
      setError('Playback didn’t start. Press play to try again.');
    });
  }, []);

  const play = useCallback(
    (ep: Episode, at?: number) => {
      if (!ep.audioUrl) return;
      const a = el();
      if (episode?.id !== ep.id || a.error) {
        a.src = ep.audioUrl;
        setTime(0);
        setDuration(ep.durationSeconds);
        setBuffering(true);
      }
      if (at !== undefined) a.currentTime = at;
      a.playbackRate = speed;
      setEpisode(ep);
      start(a);
    },
    [el, episode?.id, speed, start],
  );

  const api = useMemo<PlayerApi>(
    () => ({
      episode, playing, time, duration: duration || episode?.durationSeconds || 0, speed, buffering, error,
      play,
      toggle: () => {
        const a = audio.current;
        if (!a || !episode) return;
        if (a.paused) {
          if (a.error && episode.audioUrl) a.src = episode.audioUrl;
          start(a);
        } else a.pause();
      },
      seek: (s) => {
        const a = audio.current;
        if (!a) return;
        const max = duration || episode?.durationSeconds || 0;
        a.currentTime = Math.max(0, Math.min(s, max));
        setTime(a.currentTime);
      },
      cycleSpeed: () => {
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        setSpeed(next);
        if (audio.current) audio.current.playbackRate = next;
      },
      close: () => {
        audio.current?.pause();
        setEpisode(null);
        setError(null);
      },
    }),
    [episode, playing, time, duration, speed, buffering, error, play, start],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

/** The design's fixed mini player, wired to real audio. */
export function MiniPlayer() {
  const p = usePlayer();
  const navigate = useNavigate();
  if (!p.episode) return null;
  const ep = p.episode;
  const pct = p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0;

  const seekFromPointer = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    p.seek(((e.clientX - r.left) / r.width) * p.duration);
  };
  const seekFromKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 30 : 10;
    const keys: Record<string, number> = { ArrowRight: p.time + step, ArrowUp: p.time + step, ArrowLeft: p.time - step, ArrowDown: p.time - step, Home: 0, End: p.duration };
    if (e.key in keys) {
      e.preventDefault();
      p.seek(keys[e.key]);
    }
  };

  return (
    <section
      aria-label="Audio player"
      className="mini-player on-dark"
      style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 50, maxWidth: 1100, margin: '0 auto', background: '#081230', color: '#F7F8FC', borderRadius: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '14px 18px', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 18, alignItems: 'center' }}
    >
      <button
        type="button"
        onClick={p.toggle}
        aria-label={p.playing ? 'Pause' : 'Play'}
        className="press h-red"
        style={{ width: 48, height: 48, borderRadius: 999, border: 0, background: '#D21034', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#FFFFFF' }}
      >
        {p.buffering && p.playing ? (
          <span className="spinner" aria-hidden="true" />
        ) : p.playing ? (
          <span aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
            <span style={{ width: 4, height: 16, background: '#FFFFFF', borderRadius: 1 }} />
            <span style={{ width: 4, height: 16, background: '#FFFFFF', borderRadius: 1 }} />
          </span>
        ) : (
          <span aria-hidden="true" style={{ width: 0, height: 0, marginLeft: 3, borderLeft: '13px solid #FFFFFF', borderTop: '8px solid transparent', borderBottom: '8px solid transparent' }} />
        )}
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
          <button
            type="button"
            onClick={() => navigate(`/episodes/${ep.id}`)}
            style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', fontWeight: 600, background: 'none', border: 0, padding: 0, color: 'inherit', fontSize: 13, textAlign: 'left', minWidth: 0 }}
          >
            EP {ep.number} · {ep.title}
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#C3CCE6', flexShrink: 0 }}>
            {clock(p.time)} / {clock(p.duration)}
          </span>
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(p.duration)}
          aria-valuenow={Math.round(p.time)}
          aria-valuetext={`${clock(p.time)} of ${clock(p.duration)}`}
          onClick={seekFromPointer}
          onKeyDown={seekFromKey}
          style={{ height: 6, borderRadius: 999, background: 'rgba(247,248,252,0.15)', cursor: 'pointer', overflow: 'hidden' }}
        >
          <div style={{ height: '100%', width: `${pct}%`, background: '#D21034' }} />
        </div>
        {p.error && (
          <span role="alert" style={{ fontSize: 12, color: '#FFD1D8' }}>
            {p.error}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          onClick={p.cycleSpeed}
          aria-label={`Playback speed ${p.speed}×. Change speed`}
          style={{ background: 'transparent', border: '1px solid rgba(247,248,252,0.3)', color: '#F7F8FC', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 32 }}
        >
          {p.speed}×
        </button>
        <button type="button" onClick={p.close} aria-label="Close player" style={{ background: 'transparent', border: 0, color: '#C3CCE6', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '4px 8px', minWidth: 32, minHeight: 32 }}>
          ×
        </button>
      </div>
    </section>
  );
}
