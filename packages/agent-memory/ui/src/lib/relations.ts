import type { Relation } from '../types';

export interface RelationStyle {
  label: string;
  color: string;
  directional: boolean;
}

// Directional relations are saturated signal colors; symmetric relations are
// cooler/neutral. No purple (avoids generic AI palette). Mirrors src/graph.ts.
export const RELATION_STYLES: Record<Relation, RelationStyle> = {
  depends_on: { label: 'depends_on', color: '#ff7a18', directional: true },
  supersedes: { label: 'supersedes', color: '#ff3b3b', directional: true },
  part_of: { label: 'part_of', color: '#3fd0c9', directional: true },
  derived_from: { label: 'derived_from', color: '#5b8cff', directional: true },
  uses_service: { label: 'uses_service', color: '#7bd14a', directional: true },
  related_to: { label: 'related_to', color: '#8b9099', directional: false },
  same_workflow: { label: 'same_workflow', color: '#ffc23b', directional: false },
  same_area: { label: 'same_area', color: '#2bb1ff', directional: false },
};

export const RELATION_ORDER: Relation[] = [
  'depends_on',
  'supersedes',
  'part_of',
  'derived_from',
  'uses_service',
  'related_to',
  'same_workflow',
  'same_area',
];

export function relationColor(relation: Relation): string {
  return RELATION_STYLES[relation]?.color ?? '#8b9099';
}

export function edgeKey(fromId: string, toId: string, relation: string): string {
  return `${fromId}->${toId}:${relation}`;
}
