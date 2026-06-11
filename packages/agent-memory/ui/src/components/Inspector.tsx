import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { relationColor } from '../lib/relations';
import { useStore } from '../state/store';
import { isDisabled } from '../types';
import type { EdgeSummary, MemoryDetail } from '../types';

function EdgeRow({ edge, onSelect }: { edge: EdgeSummary; onSelect: (id: string) => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(edge.id)}
      className="focusable group flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-panel-2"
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: relationColor(edge.relation) }} />
      <span className="min-w-0 flex-1">
        <span className="readout block truncate text-[14px] text-ink-dim group-hover:text-ink">{edge.file_name}</span>
        <span className="readout text-[13px] text-ink-faint">
          {edge.direction === 'outgoing' ? '→' : '←'} {edge.relation} · {edge.weight}
          {edge.source === 'manual' ? ' · manual' : ''}
        </span>
        {edge.reason ? <span className="block text-[13px] leading-snug text-ink-faint/80">{edge.reason}</span> : null}
      </span>
    </button>
  );
}

function DetailBody({ detail }: { detail: MemoryDetail }): JSX.Element {
  const { select } = useStore();
  const links = detail.links;
  const isPointer = detail.layer === 'lite' && detail.ref !== null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="label text-[12px] text-ink-faint">{detail.layer}</span>
          {isPointer ? <span className="label text-[12px] text-warn">pointer</span> : null}
        </div>
        <h2 className="readout mt-1 break-words text-base text-amber">{detail.file_name}</h2>
        <span className="readout text-[13px] text-ink-faint">{detail.id}</span>
      </div>

      <div className="md text-ink/90">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.content}</ReactMarkdown>
      </div>

      {detail.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {detail.tags.map((tag) => (
            <span key={tag} className="readout rounded-sm border border-line px-1.5 py-0.5 text-[13px] text-ink-dim">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <Meta label="source" value={detail.source ?? '—'} />
        <Meta label="conf" value={detail.confidence ?? '—'} />
        <Meta label="imp" value={detail.importance ?? '—'} />
      </div>

      {links ? (
        <div className="flex flex-col gap-2">
          <span className="label text-[13px]">links · {links.incoming.length + links.outgoing.length}</span>
          {links.outgoing.length === 0 && links.incoming.length === 0 ? (
            <span className="readout text-[14px] text-ink-faint">no graph edges</span>
          ) : (
            <div className="flex flex-col">
              {[...links.outgoing, ...links.incoming].map((edge, index) => (
                <EdgeRow key={`${edge.id}-${edge.direction}-${index}`} edge={edge} onSelect={select} />
              ))}
            </div>
          )}
        </div>
      ) : isPointer ? (
        <span className="readout text-[14px] text-ink-faint">Index pointer — no graph participation.</span>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="panel px-2 py-1.5">
      <div className="label text-[12px]">{label}</div>
      <div className="readout truncate text-[14px] text-ink">{value}</div>
    </div>
  );
}

export function Inspector({ revision }: { revision: number }): JSX.Element | null {
  const { selectedId, select, scope } = useStore();
  // `displayId` keeps the drawer mounted (and its content visible) through the
  // close so the width can animate to 0 before unmount. `open` drives the width
  // transition: it flips on a frame after mount so the 0 -> 400 transition runs.
  const [displayId, setDisplayId] = useState<string | null>(selectedId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selectedId) {
      setDisplayId(selectedId);
      // Double rAF: let the drawer paint at width 0 for one frame before flipping
      // to open, so the 0 -> 400 width transition actually runs on first open.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setOpen(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setOpen(false);
    const timer = setTimeout(() => setDisplayId(null), 220);
    return () => clearTimeout(timer);
  }, [selectedId]);

  const resource = useResource(
    () => (displayId ? api.memory(displayId, scope) : Promise.resolve(null)),
    [displayId, scope, revision],
  );

  if (!displayId) return null;

  const detail = resource.data && !isDisabled(resource.data) ? resource.data : null;

  return (
    <aside
      className="shrink-0 overflow-hidden border-l border-line bg-panel/80 transition-[width] duration-200 ease-out"
      style={{ width: open ? 400 : 0 }}
    >
      <div className="flex h-full w-[400px] flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="label text-[13px]">inspector</span>
          <button
            type="button"
            onClick={() => select(null)}
            className="focusable rounded-sm px-1.5 text-ink-faint hover:text-amber"
            aria-label="close inspector"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {resource.loading && !detail ? (
            <span className="readout text-sm text-cyan animate-pulse-signal">acquiring…</span>
          ) : resource.error ? (
            <span className="readout text-sm text-danger">{resource.error}</span>
          ) : detail ? (
            <DetailBody detail={detail} />
          ) : (
            <span className="readout text-sm text-ink-faint">not found</span>
          )}
        </div>
      </div>
    </aside>
  );
}
