import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { ResourceView } from '../components/states';
import { useStore } from '../state/store';
import type { MemoryListItem, MemoryListPayload } from '../types';

function Row({ item, active, onClick }: { item: MemoryListItem; active: boolean; onClick: () => void }): JSX.Element {
  const isPointer = item.layer === 'lite' && item.ref !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focusable grid w-full grid-cols-[1fr_auto] items-start gap-3 border-b border-line/60 px-4 py-2.5 text-left transition-colors ${
        active ? 'bg-panel-2' : 'hover:bg-panel-2/50'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`readout truncate text-xs ${active ? 'text-amber' : 'text-ink'}`}>{item.file_name}</span>
          <span className="label shrink-0 text-[8px] text-ink-faint">{isPointer ? 'pointer' : item.layer}</span>
          {item.has_embedding ? <span className="text-[9px] text-cyan">◆</span> : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-dim">{item.content}</p>
        {item.tags.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="readout rounded-sm bg-panel px-1 text-[9px] text-ink-faint">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="readout flex flex-col items-end gap-0.5 text-[9px] text-ink-faint">
        <span>{item.source}</span>
        <span>c{item.confidence.toFixed(2)} · i{item.importance.toFixed(2)}</span>
        <span>{new Date(item.updated_at).toISOString().slice(0, 10)}</span>
      </div>
    </button>
  );
}

function Browser({ payload }: { payload: MemoryListPayload }): JSX.Element {
  const { selectedId, select } = useStore();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payload.items;
    return payload.items.filter(
      (item) =>
        item.file_name.toLowerCase().includes(needle) ||
        item.content.toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.includes(needle)),
    );
  }, [payload, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="filter by name, content, tag…"
          className="focusable readout w-full max-w-sm rounded-sm border border-line bg-panel px-2 py-1 text-xs text-ink placeholder:text-ink-faint"
        />
        <span className="readout text-[10px] text-ink-faint">
          {filtered.length}/{payload.items.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="label text-ink-faint">no matches</span>
          </div>
        ) : (
          filtered.map((item) => (
            <Row key={item.id} item={item} active={item.id === selectedId} onClick={() => select(item.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export function MemoryPanel(): JSX.Element {
  const { scope } = useStore();
  const resource = useResource(() => api.list(scope), [scope]);
  return (
    <ResourceView resource={resource} loadingLabel="loading memories">
      {(payload: MemoryListPayload) =>
        payload.items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="label text-ink-faint">no memories in this scope</span>
          </div>
        ) : (
          <Browser payload={payload} />
        )
      }
    </ResourceView>
  );
}
