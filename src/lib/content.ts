import { fetchArchive, fetchEpisodes, fetchReports, fetchSiteConfig, fetchSponsors } from './api';
import { useResource } from './resource';
import { DEFAULT_CONFIG, type ImageSlot, type SiteConfig } from './siteConfig';
import type { PublicMedia } from './types';

export const useEpisodes = () => useResource('episodes', fetchEpisodes);
export const useReports = () => useResource('reports', fetchReports);
export const useArchive = () => useResource('archive', fetchArchive);
export const useSponsors = () => useResource('sponsors', fetchSponsors);
export const useSiteConfig = () => useResource('config', fetchSiteConfig);

export interface ConfigView {
  /** Saved settings once loaded; the launch values while loading or if loading failed. */
  cfg: SiteConfig;
  status: 'loading' | 'error' | 'ready';
  retry: () => void;
  /** The image chosen for a fixed position: a media item, `null` for "use the original photo", `undefined` while unknown. */
  slot: (key: ImageSlot) => PublicMedia | null | undefined;
}

/**
 * Settings for the page chrome and fixed copy. Layout shows a visible notice
 * when they fail to load, so the launch values used meanwhile are never a
 * silent substitute.
 */
export function useConfig(): ConfigView {
  const r = useSiteConfig();
  if (r.status !== 'ready') {
    return { cfg: DEFAULT_CONFIG, status: r.status, retry: r.retry, slot: () => (r.status === 'error' ? null : undefined) };
  }
  const { config, media } = r.data;
  return {
    cfg: config,
    status: 'ready',
    retry: r.retry,
    slot: (key) => {
      const id = config.images[key];
      return id ? (media[id] ?? null) : null;
    },
  };
}

/** The YouTube channel used by every "Subscribe on YouTube" button. */
export const useChannelUrl = () => useConfig().cfg.social.youtube || DEFAULT_CONFIG.social.youtube;
