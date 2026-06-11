import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { ScatterCanvas } from '../components/ScatterCanvas';
import { ResourceView } from '../components/states';
import { useStore } from '../state/store';
import type { ScatterPayload } from '../types';

const LEGEND: Array<{ label: string; color: string }> = [
  { label: 'user_explicit', color: '#ff7a18' },
  { label: 'model_inferred', color: '#3fd0c9' },
  { label: 'tool_result', color: '#2bb1ff' },
  { label: 'repo_fact', color: '#7bd14a' },
];

function ScatterView({ payload }: { payload: ScatterPayload }): JSX.Element {
  const { selectedId, select } = useStore();
  if (payload.n < 2 || payload.points.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <div className="label mb-2 text-ink-dim">embeddings unavailable</div>
          <p className="readout text-xs leading-relaxed text-ink-faint">
            The scatter needs at least two embedded memories. Configure an OpenAI key
            (agent-memory init) and write some deep memories, then refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="label text-[10px]">PCA projection</span>
          <span className="readout text-[10px] text-ink-faint">
            {payload.n} pts · var x {Math.round(payload.variance_explained[0] * 100)}% · y{' '}
            {Math.round(payload.variance_explained[1] * 100)}%
          </span>
        </div>
        <div className="flex gap-3">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="readout text-[9px] text-ink-faint">{item.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ScatterCanvas points={payload.points} selectedId={selectedId} onSelect={select} />
      </div>
    </div>
  );
}

export function ScatterPanel(): JSX.Element {
  const { scope } = useStore();
  const resource = useResource(() => api.scatter(scope), [scope]);
  return (
    <ResourceView resource={resource} loadingLabel="projecting embeddings">
      {(payload: ScatterPayload) => <ScatterView payload={payload} />}
    </ResourceView>
  );
}
