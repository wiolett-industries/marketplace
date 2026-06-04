import { normalizeFindings } from './findings.js';

export interface RunOperation {
  type: string;
  [key: string]: unknown;
}

const SUPPORTED_OPERATIONS = [
  'set_phase',
  'set_complexity',
  'set_depth',
  'set_review_round',
  'set_clean_streak',
  'set_open_findings',
  'upsert_task',
  'complete_task',
  'upsert_chunk',
  'upsert_reviewer',
  'upsert_sanity_check',
  'merge',
];

const OPERATION_ALIASES: Record<string, string> = {
  set_task_status: 'upsert_task',
  update_task: 'upsert_task',
  set_task: 'upsert_task',
  mark_task_complete: 'complete_task',
  complete: 'complete_task',
  set_chunk_status: 'upsert_chunk',
  set_reviewer_status: 'upsert_reviewer',
  set_sanity_status: 'upsert_sanity_check',
};

export function applyOperation(state: Record<string, unknown>, operation: RunOperation): Record<string, unknown> {
  switch (operation.type) {
    case 'set_phase':
      return { ...state, phase: stringField(operation, 'phase') };
    case 'set_complexity':
      return { ...state, complexity: stringField(operation, 'complexity') };
    case 'set_depth':
      return { ...state, depth: stringField(operation, 'depth') };
    case 'set_review_round':
      return { ...state, review_round: numberField(operation, 'review_round') };
    case 'set_clean_streak':
      return { ...state, clean_streak: numberField(operation, 'clean_streak') };
    case 'set_open_findings':
      return { ...state, open_findings: normalizeFindings(operation.findings).findings };
    case 'upsert_task':
      return { ...state, tasks: upsertById(asArray(state.tasks), recordField(operation, 'task')) };
    case 'complete_task':
      return { ...state, tasks: completeById(asArray(state.tasks), stringField(operation, 'task_id')) };
    case 'upsert_chunk':
      return { ...state, chunks: upsertById(asArray(state.chunks), recordField(operation, 'chunk')) };
    case 'upsert_reviewer':
      return { ...state, reviewers: upsertById(asArray(state.reviewers), recordField(operation, 'reviewer')) };
    case 'upsert_sanity_check':
      return { ...state, sanity_checks: upsertById(asArray(state.sanity_checks), recordField(operation, 'sanity_check')) };
    case 'merge':
      return { ...state, ...recordField(operation, 'patch') };
    default:
      throw unsupportedOperationError(operation.type);
  }
}

function unsupportedOperationError(type: string): Error {
  const suggestion = nearestOperation(type);
  return new Error([
    `Unsupported workflow operation: ${type}.`,
    `Nearest supported operation: ${suggestion}.`,
    operationHint(suggestion),
    `Supported operations: ${SUPPORTED_OPERATIONS.join(', ')}.`,
  ].join(' '));
}

function nearestOperation(type: string): string {
  const normalized = type.trim();
  const alias = OPERATION_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  return SUPPORTED_OPERATIONS
    .map((operation) => ({ operation, distance: levenshtein(normalized, operation) }))
    .sort((left, right) => left.distance - right.distance || left.operation.localeCompare(right.operation))[0].operation;
}

function operationHint(operation: string): string {
  if (operation === 'upsert_task') {
    return 'To set task status, use {"type":"upsert_task","task":{"id":"T1","status":"in_progress"}}; to mark complete use {"type":"complete_task","task_id":"T1"}.';
  }
  if (operation === 'complete_task') {
    return 'To mark a task complete, use {"type":"complete_task","task_id":"T1"}.';
  }
  if (operation === 'upsert_chunk') {
    return 'To set chunk status, use {"type":"upsert_chunk","chunk":{"id":"chunk-id","status":"complete"}}.';
  }
  if (operation === 'upsert_reviewer') {
    return 'To set reviewer status, use {"type":"upsert_reviewer","reviewer":{"id":"R1","status":"done"}}.';
  }
  if (operation === 'upsert_sanity_check') {
    return 'To set sanity-check status, use {"type":"upsert_sanity_check","sanity_check":{"id":"S1","status":"done"}}.';
  }
  return `Use {"type":"${operation}", ...} with the fields documented by the Workflow MCP skill.`;
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const up = previous[column] + 1;
      const leftCost = previous[column - 1] + 1;
      const diagonalCost = diagonal + (left[row - 1] === right[column - 1] ? 0 : 1);
      diagonal = previous[column];
      previous[column] = Math.min(up, leftCost, diagonalCost);
    }
  }
  return previous[right.length];
}

export function upsertById(items: unknown[], item: Record<string, unknown>): unknown[] {
  const id = String(item.id || '').trim();
  if (!id) {
    throw new Error('upsert item requires id');
  }
  const index = items.findIndex((entry) => isRecord(entry) && entry.id === id);
  if (index === -1) {
    return [...items, item];
  }
  const next = [...items];
  next[index] = { ...(isRecord(next[index]) ? next[index] : {}), ...item };
  return next;
}

function completeById(items: unknown[], id: string): unknown[] {
  return items.map((entry) => isRecord(entry) && entry.id === id ? { ...entry, status: 'completed' } : entry);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordField(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const field = value[key];
  if (!isRecord(field)) {
    throw new Error(`${key} must be an object`);
  }
  return field;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return field;
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== 'number' || !Number.isFinite(field)) {
    throw new Error(`${key} must be a finite number`);
  }
  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
