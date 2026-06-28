import { useEffect, useRef, useState } from 'react';

/**
 * Subscribe to the server's SSE change stream. Returns a monotonically
 * increasing revision that bumps on every `change` event plus a `live` flag,
 * letting panels refetch and the status bar pulse on live-refresh.
 */
export function useEvents(): { revision: number; live: boolean; pulse: number } {
  const [revision, setRevision] = useState(0);
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource('/api/events');
    sourceRef.current = source;
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.addEventListener('change', () => {
      setRevision((value) => value + 1);
      setPulse((value) => value + 1);
    });
    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, []);

  return { revision, live, pulse };
}
