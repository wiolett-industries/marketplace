import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { Bar, Readout } from '../components/Readout';
import { ResourceView } from '../components/states';
import { relationColor, RELATION_ORDER } from '../lib/relations';
import { useStore } from '../state/store';
import type { Health, Relation } from '../types';

function HealthView({ health }: { health: Health }): JSX.Element {
  const { select } = useStore();
  const relMax = Math.max(1, ...RELATION_ORDER.map((relation) => health.edges.by_relation[relation] ?? 0));
  const histMax = Math.max(1, ...Object.values(health.weight_histogram));
  const danglingTone = health.dangling_edges.count > 0 ? 'danger' : 'default';
  const deadTone = health.dead_pointers.count > 0 ? 'danger' : 'default';

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Readout label="nodes" value={health.nodes.total} sub={`${health.nodes.graph_capable} graph-capable`} />
        <Readout label="edges" value={health.edges.total} sub={`${health.edges.manual} manual · ${health.edges.auto} auto`} tone="cyan" />
        <Readout label="orphans" value={health.orphans.count} sub="zero-degree nodes" tone={health.orphans.count > 0 ? 'warn' : 'default'} />
        <Readout label="dangling" value={health.dangling_edges.count} sub="edges to missing nodes" tone={danglingTone} />
        <Readout label="deep" value={health.nodes.deep} />
        <Readout label="lite·standalone" value={health.nodes.lite_standalone} />
        <Readout label="pointers" value={health.nodes.pointers} />
        <Readout label="dead pointers" value={health.dead_pointers.count} tone={deadTone} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="panel p-4">
          <div className="label mb-3 text-[13px]">relation distribution</div>
          <div className="flex flex-col gap-2">
            {RELATION_ORDER.map((relation: Relation) => {
              const count = health.edges.by_relation[relation] ?? 0;
              return (
                <div key={relation} className="grid grid-cols-[120px_1fr_28px] items-center gap-2">
                  <span className="readout text-[13px] text-ink-dim">{relation}</span>
                  <Bar value={count} max={relMax} color={relationColor(relation)} />
                  <span className="readout text-right text-[13px] text-ink-faint">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="readout mt-3 text-[13px] text-ink-faint">related_to share: {health.edges.related_to_share}</div>
        </section>

        <section className="panel p-4">
          <div className="label mb-3 text-[13px]">edge weight histogram</div>
          <div className="flex flex-col gap-2">
            {Object.entries(health.weight_histogram).map(([bucket, count]) => (
              <div key={bucket} className="grid grid-cols-[64px_1fr_28px] items-center gap-2">
                <span className="readout text-[13px] text-ink-dim">{bucket}</span>
                <Bar value={count} max={histMax} color="#3fd0c9" />
                <span className="readout text-right text-[13px] text-ink-faint">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-4">
          <div className="label mb-3 text-[13px]">hubs · degree &gt; {health.hubs.threshold}</div>
          {health.hubs.nodes.length === 0 ? (
            <span className="readout text-[14px] text-ink-faint">no hubs</span>
          ) : (
            <div className="flex flex-col gap-1">
              {health.hubs.nodes.map((hub) => (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => select(hub.id)}
                  className="focusable flex items-center justify-between rounded-sm px-2 py-1 text-left hover:bg-panel-2"
                >
                  <span className="readout truncate text-[14px] text-ink-dim">{hub.file_name}</span>
                  <span className="readout text-[14px] text-amber">{hub.degree}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel p-4">
          <div className="label mb-3 text-[13px] text-danger">dangling edges</div>
          {health.dangling_edges.count === 0 ? (
            <span className="readout text-[14px] text-ink-faint">none — graph is consistent</span>
          ) : (
            <div className="flex flex-col gap-1">
              {health.dangling_edges.samples.map((sample, index) => (
                <div key={index} className="readout text-[13px] text-ink-dim">
                  <span className="text-danger">{sample.relation}</span> {sample.from_id} → {sample.to_id}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function HealthPanel(): JSX.Element {
  const { scope, revision } = useStore();
  const resource = useResource(() => api.health(scope), [scope, revision]);
  return (
    <ResourceView resource={resource} loadingLabel="reading health">
      {(health: Health) => <HealthView health={health} />}
    </ResourceView>
  );
}
