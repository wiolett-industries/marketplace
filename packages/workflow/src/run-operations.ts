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
  'set_active_chunk',
  'clear_active_chunk',
  'upsert_task',
  'complete_task',
  'upsert_chunk',
  'set_chunk_status',
  'complete_chunk',
  'cancel_chunk',
  'wait_chunk',
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
  set_chunk_active: 'set_active_chunk',
  mark_chunk_active: 'set_active_chunk',
  mark_chunk_complete: 'complete_chunk',
  chunk_complete: 'complete_chunk',
  mark_chunk_cancelled: 'cancel_chunk',
  mark_chunk_canceled: 'cancel_chunk',
  cancel_chunk_status: 'cancel_chunk',
  mark_chunk_waiting: 'wait_chunk',
  wait_chunk_status: 'wait_chunk',
  set_reviewer_status: 'upsert_reviewer',
  set_sanity_status: 'upsert_sanity_check',
};

export function applyOperation(state: Record<string, unknown>, operation: RunOperation): Record<string, unknown> {
  switch (operation.type) {
    case 'set_phase': {
      const phase = stringField(operation, 'phase');
      assertNonTerminalPhase(phase);
      return { ...state, phase };
    }
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
    case 'set_active_chunk':
      return setActiveChunk(state, stringField(operation, 'chunk_id'));
    case 'clear_active_chunk':
      return { ...state, active_chunk: null };
    case 'upsert_task':
      return { ...state, tasks: upsertById(asArray(state.tasks), recordField(operation, 'task')) };
    case 'complete_task':
      return { ...state, tasks: completeById(asArray(state.tasks), stringField(operation, 'task_id')) };
    case 'upsert_chunk':
      return { ...state, chunks: upsertById(asArray(state.chunks), recordField(operation, 'chunk')) };
    case 'set_chunk_status':
      return setChunkStatus(state, stringField(operation, 'chunk_id'), stringField(operation, 'status'));
    case 'complete_chunk':
      return setChunkStatus(state, stringField(operation, 'chunk_id'), 'complete');
    case 'cancel_chunk':
      return setChunkStatus(state, stringField(operation, 'chunk_id'), 'cancelled');
    case 'wait_chunk':
      return setChunkStatus(state, stringField(operation, 'chunk_id'), 'waiting');
    case 'upsert_reviewer':
      return { ...state, reviewers: upsertById(asArray(state.reviewers), recordField(operation, 'reviewer')) };
    case 'upsert_sanity_check':
      return { ...state, sanity_checks: upsertById(asArray(state.sanity_checks), recordField(operation, 'sanity_check')) };
    case 'merge': {
      const patch = recordField(operation, 'patch');
      if (typeof patch.phase === 'string') assertNonTerminalPhase(patch.phase);
      return { ...state, ...patch };
    }
    default:
      throw unsupportedOperationError(operation.type);
  }
}

function assertNonTerminalPhase(phase: string): void {
  if (phase === 'complete' || phase === 'completed') {
    throw new Error(`Terminal phase "${phase}" is not allowed in workflow updates. Use workflow_plan_complete or workflow_audit_complete so the matching active pointer is cleared.`);
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
  if (operation === 'set_active_chunk') {
    return 'To mark a chunk active, use {"type":"set_active_chunk","chunk_id":"chunk-1"}.';
  }
  if (operation === 'set_chunk_status') {
    return 'To set chunk status, use {"type":"set_chunk_status","chunk_id":"chunk-1","status":"waiting"}.';
  }
  if (operation === 'upsert_chunk') {
    return 'To upsert chunk metadata, use {"type":"upsert_chunk","chunk":{"id":"chunk-id","status":"pending"}}.';
  }
  if (operation === 'complete_chunk') {
    return 'To mark a chunk complete, use {"type":"complete_chunk","chunk_id":"chunk-1"}.';
  }
  if (operation === 'cancel_chunk') {
    return 'To mark a chunk cancelled, use {"type":"cancel_chunk","chunk_id":"chunk-1"}.';
  }
  if (operation === 'wait_chunk') {
    return 'To mark a chunk waiting, use {"type":"wait_chunk","chunk_id":"chunk-1"}.';
  }
  if (operation === 'upsert_reviewer') {
    return 'To set reviewer status, use {"type":"upsert_reviewer","reviewer":{"id":"R1","status":"done"}}.';
  }
  if (operation === 'upsert_sanity_check') {
    return 'To set sanity-check status, use {"type":"upsert_sanity_check","sanity_check":{"id":"S1","status":"done"}}.';
  }
  return `Use {"type":"${operation}", ...} with the fields documented by the workflow-mcp skill.`;
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

function setActiveChunk(state: Record<string, unknown>, id: string): Record<string, unknown> {
  return {
    ...state,
    active_chunk: id,
    chunks: upsertById(asArray(state.chunks), { id, status: 'active' }),
  };
}

function setChunkStatus(state: Record<string, unknown>, id: string, status: string): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...state,
    chunks: upsertById(asArray(state.chunks), { id, status }),
  };
  if (state.active_chunk === id && status !== 'active' && status !== 'in_progress') {
    next.active_chunk = null;
  }
  return next;
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
