import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { api } from '../api/client';
import { useResource } from '../api/useResource';
import { FilterBar } from '../components/FilterBar';
import { RelationLegend } from '../components/RelationLegend';
import { ResourceView } from '../components/states';
import { relationColor, RELATION_STYLES } from '../lib/relations';
import { useSize } from '../lib/useSize';
import { useStore } from '../state/store';
import type { GraphEdge, GraphNode, GraphPayload, Relation } from '../types';

const NODE_REL_SIZE = 4;
const LINK_DISTANCE = 64;
const CHARGE_STRENGTH = -80;
const nodeValOf = (node: SimNode): number => 1 + node.degree * 0.4;
const nodeRadiusOf = (node: SimNode): number => NODE_REL_SIZE * Math.sqrt(nodeValOf(node));

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

interface ConfigurableForce {
  distance?: (value: number) => void;
  strength?: (value: number) => void;
}

function GraphView({ payload }: { payload: GraphPayload }): JSX.Element {
  const { filters, selectedId, select, pathHighlight } = useStore();
  const [ref, size] = useSize<HTMLDivElement>();
  const fgRef = useRef<ForceGraphMethods<SimNode, SimLink>>();
  const [hover, setHover] = useState<string | null>(null);

  // Custom hit detection. force-graph's built-in pointer detection uses a
  // separate shadow simulation whose node positions can diverge from the visible
  // ones, leaving some nodes (especially hubs) permanently unclickable. We map
  // the cursor to graph space and pick the nearest node ourselves — reliable
  // because it reads the exact node.x/node.y the visible canvas renders.
  const pickNode = (clientX: number, clientY: number): SimNode | null => {
    const fg = fgRef.current as { screen2GraphCoords?: (x: number, y: number) => { x: number; y: number } } | null;
    const container = ref.current;
    if (!fg?.screen2GraphCoords || !container) return null;
    const rect = container.getBoundingClientRect();
    const target = fg.screen2GraphCoords(clientX - rect.left, clientY - rect.top);
    let best: SimNode | null = null;
    let bestDist = Infinity;
    for (const node of graphData.nodes) {
      if (node.x == null || node.y == null) continue;
      const dx = node.x - target.x;
      const dy = node.y - target.y;
      const dist = dx * dx + dy * dy;
      const radius = nodeRadiusOf(node) + 4; // visual node radius + small tolerance
      if (dist <= radius * radius && dist < bestDist) {
        bestDist = dist;
        best = node;
      }
    }
    return best;
  };

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

  useEffect(() => {
    const graph = fgRef.current;
    if (!graph) return;

    // The library defaults are optimized for compact generic graphs. Keep this
    // dashboard navigable, but give memory nodes enough breathing room to read
    // their relation lines and hover labels in dense project stores.
    const linkForce = graph.d3Force('link') as ConfigurableForce | undefined;
    const chargeForce = graph.d3Force('charge') as ConfigurableForce | undefined;
    linkForce?.distance?.(LINK_DISTANCE);
    chargeForce?.strength?.(CHARGE_STRENGTH);
    graph.d3ReheatSimulation();
  }, [graphData, size.width, size.height]);

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

  const nodeColor = (node: SimNode): string => {
    const isSelected = node.id === selectedId;
    const isPath = highlightNodes?.has(node.id) ?? false;
    if (isSelected || isPath) return '#ff7a18';
    if (node.id === hover) return '#ffffff';
    if (highlightNodes && !isPath) return '#3a3f47'; // dim when a path is highlighted
    if (node.superseded) return '#6c4a4a';
    return node.is_standalone ? '#3fd0c9' : '#cfd3d8';
  };

  // Visual extras only — drawn over the built-in circle. Hit detection is our own
  // (pickNode), so this never affects clickability.
  const drawNodeExtras = (node: SimNode, ctx: CanvasRenderingContext2D, scale: number): void => {
    const radius = nodeRadiusOf(node);
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const isSelected = node.id === selectedId;
    const isHover = node.id === hover;
    const isPath = highlightNodes?.has(node.id) ?? false;

    if (node.superseded) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 2 / scale, 0, 2 * Math.PI);
      ctx.setLineDash([2 / scale, 2 / scale]);
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (node.is_standalone) {
      ctx.strokeStyle = '#3fd0c9';
      ctx.lineWidth = 1.4 / scale;
      ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    if (isSelected || isHover || isPath) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3 / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ff7a18';
      ctx.lineWidth = 1.4 / scale;
      ctx.stroke();
    }

    if (scale > 1.4 || isHover || isSelected) {
      ctx.font = `${10 / scale}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = isHover || isSelected ? '#e6e8ea' : '#8b9099';
      ctx.textAlign = 'center';
      ctx.fillText(node.file_name.slice(0, 28), x, y + radius + 9 / scale);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-2">
        <FilterBar visibleNodes={graphData.nodes.length} visibleEdges={visibleEdgeCount} />
        <RelationLegend counts={relationCounts} />
      </div>
      <div
        ref={ref}
        className="relative min-h-0 flex-1"
        style={{ cursor: hover ? 'pointer' : 'default' }}
        onClick={(event) => {
          const node = pickNode(event.clientX, event.clientY);
          if (node) select(node.id);
        }}
        onMouseMove={(event) => setHover(pickNode(event.clientX, event.clientY)?.id ?? null)}
        onMouseLeave={() => setHover(null)}
      >
        {size.width > 0 ? (
          <ForceGraph2D
            ref={fgRef}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="rgba(0,0,0,0)"
            nodeId="id"
            nodeRelSize={NODE_REL_SIZE}
            nodeVal={nodeValOf as never}
            nodeColor={nodeColor as never}
            nodeCanvasObjectMode={(() => 'after') as never}
            nodeCanvasObject={drawNodeExtras as never}
            enablePointerInteraction={false}
            linkVisibility={visibleLink as never}
            linkColor={((link: SimLink) => `${relationColor(link.relation)}${link.weight >= 0.6 ? 'cc' : '66'}`) as never}
            linkWidth={((link: SimLink) => 0.5 + link.weight * 2.2) as never}
            linkDirectionalArrowLength={((link: SimLink) => (RELATION_STYLES[link.relation]?.directional ? 3.5 : 0)) as never}
            linkDirectionalArrowRelPos={0.92}
            linkLineDash={((link: SimLink) => (link.symmetric ? [3, 2] : null)) as never}
            cooldownTicks={120}
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
