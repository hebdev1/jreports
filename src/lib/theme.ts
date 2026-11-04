import type { LangCode, Topic } from './types';

/** Colours and lookups lifted from the design's logic class. */
export const C = {
  bg: '#F7F8FC',
  ink: '#0B1F5C',
  blue: '#00209F',
  red: '#D21034',
  redDark: '#B00D2B',
  night: '#081230',
  deep: '#050B22',
  pink: '#FF8A9B',
  slate: '#4A5578',
  muted: '#6B6B6B', // design used #8A8A8A; darkened to pass WCAG AA on light backgrounds
  line: '#E4E8F2',
  chipLine: '#CDD4E6',
  mist: '#C3CCE6',
  haze: '#8E9AC0',
  white: '#FFFFFF',
} as const;

export const TOPIC_COVERS: Record<Topic, string> = {
  Haiti: '#00209F',
  Immigration: '#D21034',
  Community: '#0B1F5C',
  Politics: '#8A0B24',
  Culture: '#081230',
  Sports: '#B00D2B',
  Entertainment: '#4A5578',
};

export const TOPIC_DESC: Record<Topic, string> = {
  Haiti: 'Politics, security and daily life',
  Immigration: 'TPS, asylum, parole and deportation',
  Politics: 'Elections, policy and the diaspora vote',
  Community: 'South Florida neighborhoods and families',
  Culture: 'Art, music and Haitian identity',
  Sports: 'Athletes, teams and the games we follow',
  Entertainment: 'Film, TV, music and the people behind them',
};

export const LANG_NAMES: Record<LangCode, string> = { EN: 'English', FR: 'Français', KR: 'Kreyòl', ES: 'Español' };

/** Selected / unselected chip colours on light backgrounds (design `chip()`). */
export function chip(on: boolean) {
  return on
    ? { background: C.ink, color: C.bg, border: `1px solid ${C.ink}` }
    : { background: 'transparent', color: C.ink, border: `1px solid ${C.chipLine}` };
}

/** Selected / unselected tiles on white cards (design `sel()`). */
export function tile(on: boolean) {
  return on
    ? { background: C.ink, color: C.bg, border: `1px solid ${C.ink}` }
    : { background: C.white, color: C.ink, border: `1px solid ${C.chipLine}` };
}

/** Chips on the dark guest-request card (design `dk()`). */
export function darkChip(on: boolean) {
  return on
    ? { background: C.white, color: C.deep, border: `1px solid ${C.white}` }
    : { background: 'transparent', color: C.white, border: '1px solid rgba(247,248,252,0.25)' };
}
