import type { GraphDirection, GraphRelation } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { handleNeighbors, handleSubgraph } from './graph.js';

export function handleGraphView(args: {
  scope?: MemoryScope;
  memory_id: string;
  view: 'neighbors' | 'subgraph';
  depth?: number;
  direction?: GraphDirection;
  relations?: GraphRelation[];
  min_weight?: number;
  limit?: number;
  max_nodes?: number;
}) {
  if (args.view === 'subgraph') {
    return handleSubgraph({
      id: args.memory_id,
      depth: args.depth,
      direction: args.direction,
      relations: args.relations,
      min_weight: args.min_weight,
      max_nodes: args.max_nodes,
      scope: args.scope,
    });
  }

  return handleNeighbors({
    id: args.memory_id,
    direction: args.direction,
    relations: args.relations,
    min_weight: args.min_weight,
    limit: args.limit,
    scope: args.scope,
  });
}
