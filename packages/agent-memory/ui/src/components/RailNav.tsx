import { useStore } from '../state/store';
import type { PanelId } from '../state/store';

const PANELS: Array<{ id: PanelId; label: string; glyph: string }> = [
  { id: 'graph', label: 'Graph', glyph: '◍' },
  { id: 'memory', label: 'Memory', glyph: '▤' },
  { id: 'health', label: 'Health', glyph: '❤' },
  { id: 'playground', label: 'Query', glyph: '⌕' },
  { id: 'path', label: 'Path', glyph: '⤳' },
  { id: 'scatter', label: 'Scatter', glyph: '⠿' },
];

export function RailNav(): JSX.Element {
  const { panel, setPanel } = useStore();
  return (
    <nav className="flex w-[96px] flex-col items-stretch border-r border-line bg-panel/60 py-3">
      {PANELS.map((item) => {
        const active = panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => setPanel(item.id)}
            className={`focusable group relative flex flex-col items-center gap-1 py-3 transition-colors ${
              active ? 'text-amber' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-r transition-all ${
                active ? 'bg-amber shadow-[0_0_10px_0_rgba(255,122,24,0.7)]' : 'bg-transparent'
              }`}
            />
            <span className="text-xl leading-none">{item.glyph}</span>
            <span className="label text-[12px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
