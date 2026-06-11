import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { ResourceView } from '../components/states';
import { edgeKey, relationColor } from '../lib/relations';
import { useStore } from '../state/store';
import type { GraphPayload, PathResult } from '../types';

function PathTool({ payload }: { payload: GraphPayload }): JSX.Element {
  const { scope, setPanel, setPathHighlight, select } = useStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [strategy, setStrategy] = useState<'shortest' | 'strongest'>('shortest');
  const [direction, setDirection] = useState<'both' | 'outgoing' | 'incoming'>('both');
  const [result, setResult] = useState<PathResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byName = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of payload.nodes) map.set(node.file_name, node.id);
    return map;
  }, [payload]);

  const resolveId = (value: string): string => byName.get(value) ?? value;

  const run = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const fromId = resolveId(from.trim());
    const toId = resolveId(to.trim());
    if (!fromId || !toId) return;
    setBusy(true);
    setError(null);
    try {
      const path = await api.path(fromId, toId, scope, strategy, direction);
      setResult(path);
      if (path.found) {
        setPathHighlight({
          nodeIds: path.path.map((node) => node.id),
          edgeKeys: new Set(path.edges.map((edge) => edgeKey(edge.from_id, edge.to_id, edge.relation))),
        });
      } else {
        setPathHighlight(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'path failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={run} className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
        <Field label="from" value={from} onChange={setFrom} listId="nodes" />
        <Field label="to" value={to} onChange={setTo} listId="nodes" />
        <datalist id="nodes">
          {payload.nodes.map((node) => (
            <option key={node.id} value={node.file_name} />
          ))}
        </datalist>

        <Segmented
          label="strategy"
          value={strategy}
          options={['shortest', 'strongest']}
          onChange={(value) => setStrategy(value as 'shortest' | 'strongest')}
        />
        <Segmented
          label="direction"
          value={direction}
          options={['both', 'outgoing', 'incoming']}
          onChange={(value) => setDirection(value as 'both' | 'outgoing' | 'incoming')}
        />
        <button
          type="submit"
          disabled={busy}
          className="focusable label rounded-sm bg-amber px-4 py-2 text-sm text-bg hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'tracing…' : 'trace'}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? <span className="readout text-sm text-danger">{error}</span> : null}
        {result === null ? (
          <span className="readout text-[14px] text-ink-faint">pick two memories to trace a path through the graph.</span>
        ) : !result.found ? (
          <span className="readout text-[14px] text-warn">no path found between these memories with the current filters.</span>
        ) : (
          <div>
            <div className="readout mb-3 flex items-center gap-3 text-[14px] text-ink-dim">
              <span className="text-amber">{result.strategy}</span>
              <span>{result.hops} hops</span>
              <span>weight Π {result.total_weight}</span>
              <button
                type="button"
                onClick={() => setPanel('graph')}
                className="focusable label rounded-sm border border-line px-2 py-0.5 text-[12px] text-cyan hover:border-cyan"
              >
                show on graph
              </button>
            </div>
            <ol className="flex flex-col">
              {result.path.map((node, index) => {
                const edge = index > 0 ? result.edges[index - 1] : null;
                return (
                  <li key={`${node.id}-${index}`}>
                    {edge ? (
                      <div className="ml-2 flex items-center gap-2 py-1">
                        <span className="h-4 w-px" style={{ backgroundColor: relationColor(edge.relation) }} />
                        <span className="readout text-[13px]" style={{ color: relationColor(edge.relation) }}>
                          {edge.relation} · {edge.weight}
                        </span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => select(node.id)}
                      className="focusable flex items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-panel-2"
                    >
                      <span className="h-2 w-2 rounded-full bg-amber" />
                      <span className="readout text-sm text-ink">{node.file_name}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  listId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  listId: string;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="label text-[12px] text-ink-faint">{label}</span>
      <input
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        className="focusable readout w-52 rounded-sm border border-line bg-panel px-2 py-1.5 text-sm text-ink"
        placeholder="file name…"
      />
    </label>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="label text-[12px] text-ink-faint">{label}</span>
      <div className="flex overflow-hidden rounded-sm border border-line">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`focusable label px-2 py-1.5 text-[13px] transition-colors ${
              value === option ? 'bg-panel-2 text-amber' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PathPanel(): JSX.Element {
  const { scope, revision } = useStore();
  const resource = useResource(() => api.graph(scope), [scope, revision]);
  return (
    <ResourceView resource={resource} loadingLabel="loading nodes">
      {(payload: GraphPayload) => <PathTool payload={payload} />}
    </ResourceView>
  );
}
