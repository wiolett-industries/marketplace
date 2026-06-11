import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useEvents } from '../api/useEvents';
import type { Relation, Scope } from '../types';

export type PanelId = 'graph' | 'memory' | 'health' | 'playground' | 'path' | 'scatter';

export interface GraphFilters {
  relations: Set<Relation>;
  source: 'all' | 'manual' | 'auto';
  minWeight: number;
}

export interface PathHighlight {
  nodeIds: string[];
  edgeKeys: Set<string>;
}

interface StoreValue {
  scope: Scope;
  setScope: (scope: Scope) => void;
  panel: PanelId;
  setPanel: (panel: PanelId) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  filters: GraphFilters;
  setFilters: (filters: GraphFilters) => void;
  pathHighlight: PathHighlight | null;
  setPathHighlight: (highlight: PathHighlight | null) => void;
  /** Bumps on every live-refresh (SSE) change; include in resource deps to refetch. */
  revision: number;
  live: boolean;
  pulse: number;
}

const ALL_RELATIONS: Relation[] = [
  'depends_on',
  'supersedes',
  'part_of',
  'derived_from',
  'uses_service',
  'related_to',
  'same_workflow',
  'same_area',
];

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [scope, setScope] = useState<Scope>('project');
  const [panel, setPanel] = useState<PanelId>('graph');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>({
    relations: new Set(ALL_RELATIONS),
    source: 'all',
    minWeight: 0,
  });
  const [pathHighlight, setPathHighlight] = useState<PathHighlight | null>(null);
  const { revision, live, pulse } = useEvents();

  const value = useMemo<StoreValue>(
    () => ({
      scope,
      setScope: (next) => {
        setScope(next);
        setSelectedId(null);
        setPathHighlight(null);
      },
      panel,
      setPanel,
      selectedId,
      select: setSelectedId,
      filters,
      setFilters,
      pathHighlight,
      setPathHighlight,
      revision,
      live,
      pulse,
    }),
    [scope, panel, selectedId, filters, pathHighlight, revision, live, pulse],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used within StoreProvider');
  return value;
}

export { ALL_RELATIONS };
