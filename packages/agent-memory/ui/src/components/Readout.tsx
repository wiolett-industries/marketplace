import type { ReactNode } from 'react';

export function Readout({
  label,
  value,
  tone = 'default',
  sub,
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'amber' | 'cyan' | 'danger' | 'warn';
  sub?: ReactNode;
}): JSX.Element {
  const toneClass =
    tone === 'amber'
      ? 'text-amber'
      : tone === 'cyan'
        ? 'text-cyan'
        : tone === 'danger'
          ? 'text-danger'
          : tone === 'warn'
            ? 'text-warn'
            : 'text-ink';
  return (
    <div className="panel flex flex-col gap-1 px-4 py-3">
      <span className="label text-[13px]">{label}</span>
      <span className={`readout text-3xl font-medium leading-none ${toneClass}`}>{value}</span>
      {sub ? <span className="readout text-[14px] text-ink-faint">{sub}</span> : null}
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }): JSX.Element {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-panel-2">
      <div className="h-full rounded-sm transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}
