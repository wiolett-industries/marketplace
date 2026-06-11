import type { ReactNode } from 'react';
import { isDisabled } from '../types';
import type { ResourceState } from '../api/useResource';

export function PanelLoading({ label = 'acquiring' }: { label?: string }): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-pulse-signal rounded-full border border-cyan/60" />
        <span className="label readout text-xs text-cyan animate-pulse-signal">{label}…</span>
      </div>
    </div>
  );
}

export function PanelEmpty({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="label mb-2 text-ink-dim">{title}</div>
        {hint ? <p className="readout text-xs leading-relaxed text-ink-faint">{hint}</p> : null}
      </div>
    </div>
  );
}

export function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <div className="label mb-2 text-danger">signal lost</div>
        <p className="readout mb-4 break-words text-xs text-ink-dim">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="focusable label rounded-sm border border-line px-3 py-1 text-xs text-ink-dim hover:border-amber hover:text-amber"
          >
            retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Renders a resource through its lifecycle: loading → error → disabled-store →
 * data. `disabledHint` describes how to populate an empty scope.
 */
export function ResourceView<T>({
  resource,
  children,
  loadingLabel,
  disabledHint,
}: {
  resource: ResourceState<T> & { reload?: () => void };
  children: (data: T) => ReactNode;
  loadingLabel?: string;
  disabledHint?: string;
}): JSX.Element {
  if (resource.loading && !resource.data) return <PanelLoading label={loadingLabel} />;
  if (resource.error) return <PanelError message={resource.error} onRetry={resource.reload} />;
  if (!resource.data) return <PanelEmpty title="no data" />;
  if (isDisabled(resource.data)) {
    return (
      <PanelEmpty
        title="no memory store in this scope"
        hint={disabledHint ?? 'Create memories with the agent, or launch view against a project path that has a .memory directory.'}
      />
    );
  }
  return <>{children(resource.data)}</>;
}
