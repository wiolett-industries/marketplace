import { RELATION_ORDER, RELATION_STYLES } from '../lib/relations';
import { useStore } from '../state/store';
import type { Relation } from '../types';

export function RelationLegend({ counts }: { counts: Record<string, number> }): JSX.Element {
  const { filters, setFilters } = useStore();

  const toggle = (relation: Relation): void => {
    const next = new Set(filters.relations);
    if (next.has(relation)) next.delete(relation);
    else next.add(relation);
    setFilters({ ...filters, relations: next });
  };

  return (
    <div className="flex flex-wrap gap-1">
      {RELATION_ORDER.map((relation) => {
        const style = RELATION_STYLES[relation];
        const active = filters.relations.has(relation);
        const count = counts[relation] ?? 0;
        return (
          <button
            key={relation}
            type="button"
            onClick={() => toggle(relation)}
            title={`${relation} (${count})${style.directional ? '' : ' · symmetric'}`}
            className={`focusable flex items-center gap-1.5 rounded-sm border px-1.5 py-1 transition-opacity ${
              active ? 'border-line opacity-100' : 'border-transparent opacity-35'
            } hover:opacity-100`}
          >
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{
                backgroundColor: style.directional ? style.color : 'transparent',
                border: style.directional ? 'none' : `1.5px dashed ${style.color}`,
              }}
            />
            <span className="readout text-[13px] text-ink-dim">{relation}</span>
            <span className="readout text-[13px] text-ink-faint">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
