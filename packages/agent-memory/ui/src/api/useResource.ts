import { useEffect, useState } from 'react';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch-on-mount/dep-change hook with loading + error states. `deps` should
 * include the revision from useEvents so the resource refetches on live changes.
 */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[]): ResourceState<T> & { reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>({ data: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ data: prev.data, loading: true, error: null }));
    loader()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'request failed' });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((value) => value + 1) };
}
