import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MemoryScope } from './scope.js';
import { getMemoryRoot } from './scope.js';

const RECONCILIATION_DUE_AFTER_DAYS = 30;
const RECONCILIATION_FILE = 'reconciliation.json';

interface ReconciliationRecord {
  version: 1;
  last_reconciled_at: string;
}

export interface ReconciliationStatus {
  scope: MemoryScope;
  initialized: boolean;
  last_reconciled_at: string | null;
  due_after_days: number;
  due: boolean;
  reason: string;
}

function reconciliationPath(scope: MemoryScope): string {
  return path.join(getMemoryRoot(scope), 'maintenance', RECONCILIATION_FILE);
}

function readRecord(scope: MemoryScope): ReconciliationRecord | null {
  const filePath = reconciliationPath(scope);
  if (!existsSync(filePath)) return null;

  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ReconciliationRecord>;
    if (value.version !== 1 || typeof value.last_reconciled_at !== 'string' || Number.isNaN(Date.parse(value.last_reconciled_at))) {
      return null;
    }
    return { version: 1, last_reconciled_at: value.last_reconciled_at };
  } catch {
    return null;
  }
}

export function getReconciliationStatus(scope: MemoryScope = 'project', now = new Date()): ReconciliationStatus {
  const memoryRoot = getMemoryRoot(scope);
  if (!existsSync(memoryRoot)) {
    return {
      scope,
      initialized: false,
      last_reconciled_at: null,
      due_after_days: RECONCILIATION_DUE_AFTER_DAYS,
      due: false,
      reason: 'No memory store exists for this scope yet.',
    };
  }

  const record = readRecord(scope);
  if (!record) {
    return {
      scope,
      initialized: true,
      last_reconciled_at: null,
      due_after_days: RECONCILIATION_DUE_AFTER_DAYS,
      due: true,
      reason: 'No completed reconciliation has been recorded.',
    };
  }

  const ageMs = Math.max(0, now.getTime() - Date.parse(record.last_reconciled_at));
  const due = ageMs >= RECONCILIATION_DUE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return {
    scope,
    initialized: true,
    last_reconciled_at: record.last_reconciled_at,
    due_after_days: RECONCILIATION_DUE_AFTER_DAYS,
    due,
    reason: due ? 'The last recorded reconciliation is older than the cadence.' : 'The recorded reconciliation is within the cadence.',
  };
}

export function recordReconciliation(scope: MemoryScope = 'project', now = new Date()): ReconciliationStatus {
  const filePath = reconciliationPath(scope);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const record: ReconciliationRecord = {
    version: 1,
    last_reconciled_at: now.toISOString(),
  };
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  renameSync(tempPath, filePath);
  return getReconciliationStatus(scope, now);
}
