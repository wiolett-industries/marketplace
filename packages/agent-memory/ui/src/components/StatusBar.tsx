import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import type { Meta, Scope } from '../types';

function ScopeToggle({ scopes }: { scopes: { project: boolean; global: boolean } }): JSX.Element {
  const { scope, setScope } = useStore();
  const options: Scope[] = ['project', 'global'];
  return (
    <div className="flex items-center gap-1">
      <span className="label text-[12px] text-ink-faint">scope</span>
      <div className="flex overflow-hidden rounded-sm border border-line">
        {options.map((option) => {
          const available = scopes[option];
          const active = scope === option;
          return (
            <button
              key={option}
              type="button"
              disabled={!available}
              title={available ? `${option} memory` : `no ${option} store`}
              onClick={() => available && setScope(option)}
              className={`focusable label px-2 py-1 text-[13px] transition-colors ${
                active ? 'bg-amber text-bg' : available ? 'text-ink-dim hover:text-ink' : 'cursor-not-allowed text-ink-faint/50'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatusBar({ meta, live, pulse }: { meta: Meta | null; live: boolean; pulse: number }): JSX.Element {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (pulse === 0) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(timer);
  }, [pulse]);

  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-panel/70 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="font-display text-base font-bold uppercase tracking-[0.22em] text-ink">
          Agent Memory <span className="text-amber">View</span>
        </span>
        <span className="hairline hidden w-8 sm:block" />
        {meta ? <ScopeToggle scopes={meta.scopes} /> : null}
      </div>

      <div className="flex items-center gap-4">
        {meta ? (
          <>
            <Stat label="nodes" value={meta.counts.nodes} />
            <Stat label="edges" value={meta.counts.edges} />
            <span
              title={
                meta.embeddings_available
                  ? 'Embeddings present — semantic search and the Scatter panel are active'
                  : 'No embeddings — search is lexical only and Scatter is empty (configure an OpenAI key)'
              }
              className={`readout rounded-sm border px-1.5 py-0.5 text-[13px] ${
                meta.embeddings_available ? 'border-cyan/40 text-cyan' : 'border-line text-ink-faint'
              }`}
            >
              {meta.embeddings_available ? 'embeddings ✓' : 'embeddings ✕'}
            </span>
          </>
        ) : null}
        <span className="readout text-[13px] text-ink-faint">:{window.location.port || '—'}</span>
        <div className="flex items-center gap-1.5" title={live ? 'live-refresh connected' : 'live-refresh offline'}>
          <span
            className={`h-2 w-2 rounded-full ${
              flash ? 'bg-cyan shadow-[0_0_8px_2px_rgba(63,208,201,0.8)]' : live ? 'bg-cyan/70' : 'bg-ink-faint'
            } ${flash ? 'animate-pulse-signal' : ''}`}
          />
          <span className="label text-[12px] text-ink-faint">{live ? 'live' : 'idle'}</span>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <span className="flex items-baseline gap-1">
      <span className="readout text-base text-ink">{value}</span>
      <span className="label text-[12px] text-ink-faint">{label}</span>
    </span>
  );
}
