import { useCallback, useEffect, useState } from 'react';
import { ApiError, toApiError } from './api';

export type Resource<T> =
  | { status: 'loading'; retry: () => void }
  | { status: 'error'; error: ApiError; retry: () => void }
  | { status: 'ready'; data: T; retry: () => void };

// Successful loads are shared across components for the session, so the
// header, home page and episode pages read the episode list once.
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = fetcher()
    .then((data) => {
      cache.set(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function useResource<T>(key: string, fetcher: () => Promise<T>): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; data: T }>(() =>
    cache.has(key) ? { status: 'ready', data: cache.get(key) as T } : { status: 'loading' },
  );

  useEffect(() => {
    if (cache.has(key)) {
      setState({ status: 'ready', data: cache.get(key) as T });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    load(key, fetcher).then(
      (data) => alive && setState({ status: 'ready', data }),
      (err) => alive && setState({ status: 'error', error: toApiError(err) }),
    );
    return () => {
      alive = false;
    };
    // fetcher is a module-level function per key; re-running on identity changes would refetch needlessly.
  }, [key, attempt]);

  const retry = useCallback(() => {
    cache.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  return { ...state, retry } as Resource<T>;
}

/** Test helper: forget every cached load. */
export function clearResourceCache() {
  cache.clear();
  inflight.clear();
}
