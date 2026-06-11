import { useStore } from '../state/store';

export function FilterBar({ visibleNodes, visibleEdges }: { visibleNodes: number; visibleEdges: number }): JSX.Element {
  const { filters, setFilters } = useStore();
  const sources: Array<'all' | 'manual' | 'auto'> = ['all', 'manual', 'auto'];

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        <span className="label text-[12px] text-ink-faint">source</span>
        <div className="flex overflow-hidden rounded-sm border border-line">
          {sources.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setFilters({ ...filters, source })}
              className={`focusable label px-2 py-1 text-[13px] transition-colors ${
                filters.source === source ? 'bg-panel-2 text-amber' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2">
        <span className="label text-[12px] text-ink-faint">min w</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.minWeight}
          onChange={(event) => setFilters({ ...filters, minWeight: Number(event.target.value) })}
          className="accent-amber"
        />
        <span className="readout w-8 text-[13px] text-ink-dim">{filters.minWeight.toFixed(2)}</span>
      </label>

      <span className="readout text-[13px] text-ink-faint">
        {visibleNodes}n · {visibleEdges}e
      </span>
    </div>
  );
}
