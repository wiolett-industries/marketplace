import { useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { FilterBar } from '../components/FilterBar';
import { RelationLegend } from '../components/RelationLegend';
import { ResourceView } from '../components/states';
import { relationColor, RELATION_STYLES } from '../lib/relations';
import { useSize } from '../lib/useSize';
import { useStore } from '../state/store';
import type { GraphEdge, GraphNode, GraphPayload, Relation } from '../types';

interface SimNode extends GraphNode {
  x?: number;
  y?: number;
}

// ForceGraph reserves `source`/`target` for endpoints, so the edge's own
// manual/auto origin is carried as `edgeSource`.
interface SimLink {
  source: string;
  target: string;
  relation: Relation;
  weight: number;
  edgeSource: 'manual' | 'auto';
  symmetric: boolean;
}

function GraphView({ payload }: { payload: GraphPayload }): JSX.Element {
  const { filters, selectedId, select, pathHighlight } = useStore();
  const [ref, size] = useSize<HTMLDivElement>();
  const fgRef = useRef<unknown>(null);
  const [hover, setHover] = useState<string | null>(null);

  const graphData = useMemo(() => {
    const nodes: SimNode[] = payload.nodes.map((node) => ({ ...node }));
    const links: SimLink[] = payload.edges.map((edge: GraphEdge) => ({
      source: edge.from_id,
      target: edge.to_id,
      relation: edge.relation,
      weight: edge.weight,
      edgeSource: edge.source,
      symmetric: edge.symmetric,
    }));
    return { nodes, links };
  }, [payload]);

  const relationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edge of payload.edges) counts[edge.relation] = (counts[edge.relation] ?? 0) + 1;
    return counts;
  }, [payload]);

  const passesSource = (link: SimLink): boolean => filters.source === 'all' || link.edgeSource === filters.source;
  const visibleLink = (link: SimLink): boolean =>
    filters.relations.has(link.relation) && passesSource(link) && link.weight >= filters.minWeight;

  const visibleEdgeCount = useMemo(
    () => graphData.links.filter(visibleLink).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphData, filters],
  );

  const highlightNodes = pathHighlight ? new Set(pathHighlight.nodeIds) : null;

  const drawNode = (node: SimNode, ctx: CanvasRenderingContext2D, scale: number): void => {
    const radius = 3 + Math.sqrt(node.degree) * 1.6;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isSelected = node.id === selectedId;
    const isHover = node.id === hover;
    const isPath = highlightNodes?.has(node.id) ?? false;
    const dim = (highlightNodes != null && !isPath) || node.superseded;

    const base = node.is_standalone ? '#3fd0c9' : '#cfd3d8';
    const color = isSelected || isPath ? '#ff7a18' : base;

    ctx.globalAlpha = dim ? 0.3 : 1;
    ctx.beginPath();
    if (node.is_standalone) {
      ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4 / scale;
      ctx.stroke();
    } else {
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (node.superseded) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 2 / scale, 0, 2 * Math.PI);
      ctx.setLineDash([2 / scale, 2 / scale]);
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (isSelected || isHover || isPath) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ff7a18';
      ctx.lineWidth = 1.2 / scale;
      ctx.stroke();
    }

    if (scale > 1.6 || isHover || isSelected) {
      ctx.globalAlpha = dim ? 0.4 : 1;
      ctx.font = `${10 / scale}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = '#8b9099';
      ctx.textAlign = 'center';
      ctx.fillText(node.file_name.slice(0, 28), x, y + radius + 9 / scale);
    }
    ctx.globalAlpha = 1;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-2">
        <FilterBar visibleNodes={graphData.nodes.length} visibleEdges={visibleEdgeCount} />
        <RelationLegend counts={relationCounts} />
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        {size.width > 0 ? (
          <ForceGraph2D
            ref={fgRef as never}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeId="id"
            linkVisibility={visibleLink as never}
            linkColor={((link: SimLink) => `${relationColor(link.relation)}${link.weight >= 0.6 ? 'cc' : '66'}`) as never}
            linkWidth={((link: SimLink) => 0.5 + link.weight * 2.2) as never}
            linkDirectionalArrowLength={((link: SimLink) => (RELATION_STYLES[link.relation]?.directional ? 3.5 : 0)) as never}
            linkDirectionalArrowRelPos={0.92}
            linkLineDash={((link: SimLink) => (link.symmetric ? [3, 2] : null)) as never}
            nodeCanvasObject={drawNode as never}
            nodePointerAreaPaint={((node: SimNode, color: string, ctx: CanvasRenderingContext2D) => {
              const radius = 5 + Math.sqrt(node.degree) * 1.6;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI);
              ctx.fill();
            }) as never}
            onNodeClick={((node: SimNode) => select(node.id)) as never}
            onNodeHover={((node: SimNode | null) => setHover(node?.id ?? null)) as never}
            cooldownTicks={120}
            warmupTicks={20}
          />
        ) : null}
      </div>
    </div>
  );
}

export function GraphPanel(): JSX.Element {
  const { scope, revision } = useStore();
  const resource = useResource(() => api.graph(scope), [scope, revision]);
  return (
    <ResourceView resource={resource} loadingLabel="mapping graph">
      {(payload: GraphPayload) =>
        payload.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="label text-ink-faint">no memories in this scope</span>
          </div>
        ) : (
          <GraphView payload={payload} />
        )
      }
    </ResourceView>
  );
}
