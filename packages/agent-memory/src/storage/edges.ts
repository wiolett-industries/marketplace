import type { GraphDirection, GraphEdgeRecord, GraphEdgeSummary, GraphRelation } from '../graph.js';
import type { MemoryScope } from '../scope.js';
import { getDb } from './connection.js';

interface GraphEdgeSummaryRow {
  id: string;
  file_name: string;
  relation: string;
  weight: number;
  reason: string | null;
  source: 'manual' | 'auto';
}

const GRAPH_NODES_CTE = `
  WITH graph_nodes AS (
    SELECT id, file_name FROM memories
    UNION ALL
    SELECT id, file_name FROM memory_index WHERE memory_id IS NULL
  )
`;

export function replaceOutgoingEdges(fromId: string, edges: GraphEdgeRecord[], scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  db.prepare('DELETE FROM memory_edges WHERE from_id = ?').run(fromId);
  const insert = db.prepare(`
    INSERT INTO memory_edges (from_id, to_id, relation, weight, reason, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const edge of edges) {
    insert.run(edge.from_id, edge.to_id, edge.relation, edge.weight, edge.reason, edge.source, edge.created_at, edge.updated_at);
  }
}

export function replaceAutoOutgoingEdges(fromId: string, edges: GraphEdgeRecord[], scope: MemoryScope = 'project'): void {
  const db = getDb(scope);
  // The tuple primary key deliberately does not include `source`: a manual
  // relationship is authoritative over an automatically inferred one. Filter
  // before deleting any current auto edges so a bad or stale candidate cannot
  // turn a manual collision into a partially-applied refresh.
  const manualKeys = new Set(
    (db.prepare("SELECT to_id, relation FROM memory_edges WHERE from_id = ? AND source = 'manual'").all(fromId) as Array<{ to_id: string; relation: string }>)
      .map((edge) => `${edge.to_id}:${edge.relation}`)
  );
  const safeEdges = edges.filter((edge) => !manualKeys.has(`${edge.to_id}:${edge.relation}`));
  const insert = db.prepare(`
    INSERT INTO memory_edges (from_id, to_id, relation, weight, reason, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'auto', ?, ?)
  `);

  // SQLite is the cache, but it must not be left halfway through a refresh if
  // an unexpected constraint or I/O failure occurs.
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("DELETE FROM memory_edges WHERE from_id = ? AND source = 'auto'").run(fromId);
    for (const edge of safeEdges) {
      insert.run(edge.from_id, edge.to_id, edge.relation, edge.weight, edge.reason, edge.created_at, edge.updated_at);
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* The transaction may already be closed. */ }
    throw error;
  }
}

export function deleteIncomingAutoEdges(toId: string, scope: MemoryScope = 'project'): string[] {
  const db = getDb(scope);
  const rows = db.prepare("SELECT DISTINCT from_id FROM memory_edges WHERE to_id = ? AND source = 'auto'").all(toId) as Array<{ from_id: string }>;
  db.prepare("DELETE FROM memory_edges WHERE to_id = ? AND source = 'auto'").run(toId);
  return rows.map((row) => row.from_id);
}

export function deleteEdgesForEntry(id: string, scope: MemoryScope = 'project'): void {
  getDb(scope).prepare('DELETE FROM memory_edges WHERE from_id = ? OR to_id = ?').run(id, id);
}

export function getOutgoingEdgeRecords(fromId: string, scope: MemoryScope = 'project'): GraphEdgeRecord[] {
  return getDb(scope)
    .prepare(`
      SELECT from_id, to_id, relation, weight, reason, source, created_at, updated_at
      FROM memory_edges
      WHERE from_id = ?
      ORDER BY weight DESC, updated_at DESC, to_id ASC
    `)
    .all(fromId) as unknown as GraphEdgeRecord[];
}

export function getAllEdgeRows(scope: MemoryScope = 'project'): GraphEdgeRecord[] {
  return getDb(scope)
    .prepare('SELECT from_id, to_id, relation, weight, reason, source, created_at, updated_at FROM memory_edges')
    .all() as unknown as GraphEdgeRecord[];
}

export function getEdgeSummaries(id: string, scope: MemoryScope = 'project'): { outgoing: GraphEdgeSummary[]; incoming: GraphEdgeSummary[] } {
  const db = getDb(scope);
  const outgoingRows = db.prepare(`
    ${GRAPH_NODES_CTE}
    SELECT n.id, n.file_name, me.relation, me.weight, me.reason, me.source
    FROM memory_edges me
    JOIN graph_nodes n ON n.id = me.to_id
    WHERE me.from_id = ?
    ORDER BY me.weight DESC, me.updated_at DESC, n.file_name ASC
  `).all(id) as unknown as GraphEdgeSummaryRow[];
  const incomingRows = db.prepare(`
    ${GRAPH_NODES_CTE}
    SELECT n.id, n.file_name, me.relation, me.weight, me.reason, me.source
    FROM memory_edges me
    JOIN graph_nodes n ON n.id = me.from_id
    WHERE me.to_id = ?
    ORDER BY me.weight DESC, me.updated_at DESC, n.file_name ASC
  `).all(id) as unknown as GraphEdgeSummaryRow[];

  return {
    outgoing: outgoingRows.map((row) => toSummary(row, 'outgoing')),
    incoming: incomingRows.map((row) => toSummary(row, 'incoming')),
  };
}

export function getNeighborSummaries(args: {
  id: string;
  direction: GraphDirection;
  relations?: GraphRelation[];
  minWeight: number;
  limit: number;
  scope?: MemoryScope;
}): GraphEdgeSummary[] {
  const db = getDb(args.scope);
  const conditions: string[] = ['me.weight >= ?'];
  const params: Array<string | number> = [args.minWeight];
  if (args.relations?.length) {
    conditions.push(`me.relation IN (${args.relations.map(() => '?').join(', ')})`);
    params.push(...args.relations);
  }
  const where = conditions.join(' AND ');
  const limit = Math.max(1, args.limit);
  const summaries: GraphEdgeSummary[] = [];

  if (args.direction === 'outgoing' || args.direction === 'both') {
    const rows = db.prepare(`
      ${GRAPH_NODES_CTE}
      SELECT n.id, n.file_name, me.relation, me.weight, me.reason, me.source
      FROM memory_edges me
      JOIN graph_nodes n ON n.id = me.to_id
      WHERE me.from_id = ? AND ${where}
      ORDER BY me.weight DESC, me.updated_at DESC, n.file_name ASC
      LIMIT ?
    `).all(args.id, ...params, limit) as unknown as GraphEdgeSummaryRow[];
    summaries.push(...rows.map((row) => toSummary(row, 'outgoing')));
  }

  if (args.direction === 'incoming' || args.direction === 'both') {
    const rows = db.prepare(`
      ${GRAPH_NODES_CTE}
      SELECT n.id, n.file_name, me.relation, me.weight, me.reason, me.source
      FROM memory_edges me
      JOIN graph_nodes n ON n.id = me.from_id
      WHERE me.to_id = ? AND ${where}
      ORDER BY me.weight DESC, me.updated_at DESC, n.file_name ASC
      LIMIT ?
    `).all(args.id, ...params, limit) as unknown as GraphEdgeSummaryRow[];
    summaries.push(...rows.map((row) => toSummary(row, 'incoming')));
  }

  return summaries
    .sort((left, right) => right.weight - left.weight || left.file_name.localeCompare(right.file_name))
    .slice(0, limit);
}

export function getFilteredEdgeRows(args: {
  ids: string[];
  direction: GraphDirection;
  relations?: GraphRelation[];
  minWeight: number;
  scope?: MemoryScope;
}): GraphEdgeRecord[] {
  if (!args.ids.length) return [];
  const filters: string[] = ['weight >= ?'];
  const filterParams: Array<string | number> = [args.minWeight];
  if (args.relations?.length) {
    filters.push(`relation IN (${args.relations.map(() => '?').join(', ')})`);
    filterParams.push(...args.relations);
  }

  const idPlaceholders = args.ids.map(() => '?').join(', ');
  const directionParams: Array<string | number> = [];
  let directionClause = '';
  if (args.direction === 'outgoing') {
    directionClause = `from_id IN (${idPlaceholders})`;
    directionParams.push(...args.ids);
  } else if (args.direction === 'incoming') {
    directionClause = `to_id IN (${idPlaceholders})`;
    directionParams.push(...args.ids);
  } else {
    directionClause = `(from_id IN (${idPlaceholders}) OR to_id IN (${idPlaceholders}))`;
    directionParams.push(...args.ids, ...args.ids);
  }

  return getDb(args.scope)
    .prepare(`
      SELECT from_id, to_id, relation, weight, reason, source, created_at, updated_at
      FROM memory_edges
      WHERE ${directionClause} AND ${filters.join(' AND ')}
    `)
    .all(...directionParams, ...filterParams) as unknown as GraphEdgeRecord[];
}

/** Batch check: of the given ids, which have an incoming `supersedes` edge. */
export function getIncomingSupersededIds(ids: string[], scope: MemoryScope = 'project'): Set<string> {
  if (!ids.length) return new Set();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = getDb(scope)
    .prepare(`SELECT DISTINCT to_id FROM memory_edges WHERE relation = 'supersedes' AND to_id IN (${placeholders})`)
    .all(...ids) as unknown as Array<{ to_id: string }>;
  return new Set(rows.map((row) => row.to_id));
}

function toSummary(row: GraphEdgeSummaryRow, direction: 'outgoing' | 'incoming'): GraphEdgeSummary {
  return {
    id: row.id,
    file_name: row.file_name,
    relation: row.relation as GraphRelation,
    weight: row.weight,
    reason: row.reason,
    source: row.source,
    direction,
  };
}
