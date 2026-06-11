import { api } from './api/client';
import { useResource } from './api/useResource';
import { RailNav } from './components/RailNav';
import { StatusBar } from './components/StatusBar';
import { Inspector } from './components/Inspector';
import { GraphPanel } from './panels/GraphPanel';
import { MemoryPanel } from './panels/MemoryPanel';
import { HealthPanel } from './panels/HealthPanel';
import { PlaygroundPanel } from './panels/PlaygroundPanel';
import { PathPanel } from './panels/PathPanel';
import { ScatterPanel } from './panels/ScatterPanel';
import { StoreProvider, useStore } from './state/store';
import { isDisabled } from './types';

function PanelHost(): JSX.Element {
  const { panel } = useStore();
  switch (panel) {
    case 'graph':
      return <GraphPanel />;
    case 'memory':
      return <MemoryPanel />;
    case 'health':
      return <HealthPanel />;
    case 'playground':
      return <PlaygroundPanel />;
    case 'path':
      return <PathPanel />;
    case 'scatter':
      return <ScatterPanel />;
    default:
      return <GraphPanel />;
  }
}

function AppInner(): JSX.Element {
  const { scope, revision, live, pulse } = useStore();
  const metaResource = useResource(() => api.meta(scope), [scope, revision]);
  const meta = metaResource.data && !isDisabled(metaResource.data) ? metaResource.data : null;

  return (
    <div className="flex h-full flex-col">
      <StatusBar meta={meta} live={live} pulse={pulse} />
      <div className="flex min-h-0 flex-1">
        <RailNav />
        <main key={scope} className="relative min-w-0 flex-1 animate-rise-in">
          <PanelHost />
        </main>
        <Inspector revision={revision} />
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
