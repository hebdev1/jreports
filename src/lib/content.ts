import { fetchArchive, fetchEpisodes, fetchReports, fetchSettings } from './api';
import { useResource } from './resource';

export const useEpisodes = () => useResource('episodes', fetchEpisodes);
export const useReports = () => useResource('reports', fetchReports);
export const useArchive = () => useResource('archive', fetchArchive);
export const useSettings = () => useResource('settings', fetchSettings);
