import { describe, expect, it } from 'vitest';
import { ApiError, mapEpisode, toApiError } from '../lib/api';
import { clock, money, shortDate, withFees } from '../lib/format';
import { sx } from '../lib/sx';
import { filterEpisodes } from '../pages/Episodes';
import { pledgeAmount } from '../pages/Support';
import type { Episode } from '../lib/types';

describe('sx', () => {
  it('turns design CSS strings into React styles, including vendor prefixes and custom properties', () => {
    expect(sx("font-family:'Oswald',sans-serif;-webkit-font-smoothing:antialiased;--x:1px;grid-template-columns:repeat(2,1fr)")).toEqual({
      fontFamily: "'Oswald',sans-serif",
      WebkitFontSmoothing: 'antialiased',
      '--x': '1px',
      gridTemplateColumns: 'repeat(2,1fr)',
    });
  });

  it('returns the same cached object for the same string', () => {
    expect(sx('color:red')).toBe(sx('color:red'));
  });
});

describe('format', () => {
  it('formats durations like the design', () => {
    expect(clock(3492)).toBe('58:12');
    expect(clock(4000)).toBe('1:06:40');
    expect(clock(-5)).toBe('0:00');
  });

  it('formats money and the 3% fee', () => {
    expect(money(1_200_000)).toBe('$12,000');
    expect(money(3090)).toBe('$30.90');
    expect(withFees(2500, true)).toBe(2575);
    expect(withFees(2500, false)).toBe(2500);
  });

  it('reads ISO dates as calendar dates', () => {
    expect(shortDate('2026-09-18')).toBe('Sep 18, 2026');
  });
});

describe('API errors', () => {
  it('maps database validation codes to readable messages', () => {
    const e = toApiError({ message: 'invalid:email', code: '22023' });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('validation');
    expect(e.field).toBe('email');
    expect(e.message).toBe('Please check your email address.');
    expect(toApiError({ message: 'required:pitch' }).message).toBe('Please add your story or topic.');
  });

  it('recognises throttling, network failures and timeouts', () => {
    expect(toApiError({ message: 'rate_limited' }).code).toBe('rate_limited');
    expect(toApiError(new TypeError('Failed to fetch')).code).toBe('network');
    expect(toApiError({ name: 'AbortError', message: 'signal is aborted' }).code).toBe('timeout');
    expect(toApiError({ message: 'permission denied for table x' }).code).toBe('server');
  });
});

const ep = (over: Partial<Episode>): Episode => ({
  id: 'ep-1', number: 1, title: 'T', dek: '', guest: '', topic: 'Haiti', language: 'EN', durationSeconds: 60, publishedOn: '2026-01-01',
  youtubeId: null, audioUrl: null, chapters: [], ...over,
});

describe('episodes', () => {
  it('drops malformed chapters from the database row', () => {
    const e = mapEpisode({
      id: 'ep-48', number: 48, title: 't', dek: '', guest: '', topic: 'Haiti', language: 'EN', duration_seconds: 10, published_on: '2026-09-18',
      youtube_id: null, audio_url: null, chapters: [{ at: 0, label: 'Intro' }, { at: 'x', label: 'bad' } as never, { at: 5 } as never],
    });
    expect(e.chapters).toEqual([{ at: 0, label: 'Intro' }]);
  });

  it('filters by topic and language, ignoring unknown values', () => {
    const list = [ep({ id: 'a', topic: 'Haiti', language: 'KR' }), ep({ id: 'b', topic: 'Sports', language: 'EN' }), ep({ id: 'c', topic: 'Haiti', language: 'EN' })];
    expect(filterEpisodes(list, 'Haiti', null).map((e) => e.id)).toEqual(['a', 'c']);
    expect(filterEpisodes(list, 'Haiti', 'KR').map((e) => e.id)).toEqual(['a']);
    expect(filterEpisodes(list, 'Nonsense', 'XX')).toHaveLength(3);
    expect(filterEpisodes(list, 'Sports', 'KR')).toEqual([]);
  });
});

describe('donation amount', () => {
  it('uses the custom field when filled, in whole dollars', () => {
    expect(pledgeAmount(25, '')).toBe(2500);
    expect(pledgeAmount(25, '30')).toBe(3000);
    expect(pledgeAmount(25, '0')).toBe(0);
  });
});
