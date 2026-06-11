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
        <span className="readout block truncate text-[11px] text-ink-dim group-hover:text-ink">{edge.file_name}</span>
        <span className="readout text-[10px] text-ink-faint">
          {edge.direction === 'outgoing' ? '→' : '←'} {edge.relation} · {edge.weight}
          {edge.source === 'manual' ? ' · manual' : ''}
        </span>
        {edge.reason ? <span className="block text-[10px] leading-snug text-ink-faint/80">{edge.reason}</span> : null}
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
          <span className="label text-[9px] text-ink-faint">{detail.layer}</span>
          {isPointer ? <span className="label text-[9px] text-warn">pointer</span> : null}
        </div>
        <h2 className="readout mt-1 break-words text-sm text-amber">{detail.file_name}</h2>
        <span className="readout text-[10px] text-ink-faint">{detail.id}</span>
      </div>

      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90">{detail.content}</p>

      {detail.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {detail.tags.map((tag) => (
            <span key={tag} className="readout rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-ink-dim">
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
          <span className="label text-[10px]">links · {links.incoming.length + links.outgoing.length}</span>
          {links.outgoing.length === 0 && links.incoming.length === 0 ? (
            <span className="readout text-[11px] text-ink-faint">no graph edges</span>
          ) : (
            <div className="flex flex-col">
              {[...links.outgoing, ...links.incoming].map((edge, index) => (
                <EdgeRow key={`${edge.id}-${edge.direction}-${index}`} edge={edge} onSelect={select} />
              ))}
            </div>
          )}
        </div>
      ) : isPointer ? (
        <span className="readout text-[11px] text-ink-faint">Index pointer — no graph participation.</span>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="panel px-2 py-1.5">
      <div className="label text-[9px]">{label}</div>
      <div className="readout truncate text-[11px] text-ink">{value}</div>
    </div>
  );
}

export function Inspector({ revision }: { revision: number }): JSX.Element | null {
  const { selectedId, select, scope } = useStore();
  const resource = useResource(
    () => (selectedId ? api.memory(selectedId, scope) : Promise.resolve(null)),
    [selectedId, scope, revision],
  );

  if (!selectedId) return null;

  const detail = resource.data && !isDisabled(resource.data) ? resource.data : null;

  return (
    <aside className="flex w-[340px] shrink-0 animate-rise-in flex-col border-l border-line bg-panel/80">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="label text-[10px]">inspector</span>
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
          <span className="readout text-xs text-cyan animate-pulse-signal">acquiring…</span>
        ) : resource.error ? (
          <span className="readout text-xs text-danger">{resource.error}</span>
        ) : detail ? (
          <DetailBody detail={detail} />
        ) : (
          <span className="readout text-xs text-ink-faint">not found</span>
        )}
      </div>
    </aside>
  );
}
