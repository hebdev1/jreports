import { useCallback, useRef, useState } from 'react';
import { toApiError, type ApiError } from './api';

type Status = 'idle' | 'submitting' | 'done';

/**
 * Tracks one form submission: blocks double submits, keeps the result for the
 * success panel and the error for the alert, and lets the form start over.
 */
export function useSubmit<T>() {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const busy = useRef(false);

  const run = useCallback(async (task: () => Promise<T>) => {
    if (busy.current) return;
    busy.current = true;
    setStatus('submitting');
    setError(null);
    try {
      const value = await task();
      setResult(value);
      setStatus('done');
    } catch (err) {
      setError(toApiError(err));
      setStatus('idle');
    } finally {
      busy.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, submitting: status === 'submitting', done: status === 'done', result, error, run, reset };
}
