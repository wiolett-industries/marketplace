import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MemoryScope } from './scope.js';
import { getMemoryRoot } from './scope.js';

const RECONCILIATION_DUE_AFTER_DAYS = 30;
const RECONCILIATION_FILE = 'reconciliation.json';

export type ReconciliationChange = {
  action: 'saved' | 'updated' | 'deleted' | 'repaired';
  memory_id?: string;
  summary: string;
};

export type ReconciliationReport = {
  summary: string;
  reviewed?: number;
  changes: ReconciliationChange[];
  unresolved: string[];
};

type ReconciliationRecord = {
  version: 1;
  last_reconciled_at: string;
} | {
  version: 2;
  last_reconciled_at: string;
  report?: ReconciliationReport;
};

export interface ReconciliationStatus {
  scope: MemoryScope;
  initialized: boolean;
  last_reconciled_at: string | null;
  due_after_days: number;
  due: boolean;
  reason: string;
  report: ReconciliationReport | null;
}

function reconciliationPath(scope: MemoryScope): string {
  return path.join(getMemoryRoot(scope), 'maintenance', RECONCILIATION_FILE);
}

function readRecord(scope: MemoryScope): ReconciliationRecord | null {
  const filePath = reconciliationPath(scope);
  if (!existsSync(filePath)) return null;

  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ReconciliationRecord>;
    if ((value.version !== 1 && value.version !== 2) || typeof value.last_reconciled_at !== 'string' || Number.isNaN(Date.parse(value.last_reconciled_at))) {
      return null;
    }
    const report = value.version === 2 ? parseReport(value.report) : null;
    return report ? { version: 2, last_reconciled_at: value.last_reconciled_at, report } : { version: value.version, last_reconciled_at: value.last_reconciled_at };
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
      report: null,
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
      report: null,
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
    report: record.version === 2 ? record.report ?? null : null,
  };
}

export function recordReconciliation(
  scope: MemoryScope = 'project',
  report?: ReconciliationReport,
  now = new Date(),
): ReconciliationStatus {
  const filePath = reconciliationPath(scope);
  mkdirSync(path.dirname(filePath), { recursive: true });
  const record: ReconciliationRecord = {
    version: 2,
    last_reconciled_at: now.toISOString(),
    ...(report ? { report: normalizeReport(report) } : {}),
  };
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  renameSync(tempPath, filePath);
  return getReconciliationStatus(scope, now);
}

function parseReport(value: unknown): ReconciliationReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Partial<ReconciliationReport>;
  if (typeof report.summary !== 'string' || !report.summary.trim() || !Array.isArray(report.changes) || !Array.isArray(report.unresolved)) return null;
  const changes = report.changes.flatMap((change) => {
    if (!change || typeof change !== 'object' || Array.isArray(change)) return [];
    const item = change as Partial<ReconciliationChange>;
    return (item.action === 'saved' || item.action === 'updated' || item.action === 'deleted' || item.action === 'repaired') && typeof item.summary === 'string' && item.summary.trim()
      ? [{ action: item.action, ...(typeof item.memory_id === 'string' && item.memory_id.trim() ? { memory_id: item.memory_id } : {}), summary: item.summary }]
      : [];
  });
  if (changes.length !== report.changes.length || report.unresolved.some((item) => typeof item !== 'string')) return null;
  return {
    summary: report.summary,
    ...(typeof report.reviewed === 'number' && Number.isInteger(report.reviewed) && report.reviewed >= 0 ? { reviewed: report.reviewed } : {}),
    changes,
    unresolved: report.unresolved,
  };
}

function normalizeReport(report: ReconciliationReport): ReconciliationReport {
  const parsed = parseReport(report);
  if (!parsed) throw new Error('Invalid reconciliation report.');
  return parsed;
}
