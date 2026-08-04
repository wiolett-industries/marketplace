import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getReconciliationStatus, recordReconciliation } from '../dist/reconciliation.js';

function withProjectRoot(fn) {
  const previous = process.env.PROJECT_MEMORY_PROJECT_ROOT;
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'agent-memory-reconciliation-'));
  process.env.PROJECT_MEMORY_PROJECT_ROOT = projectRoot;
  try {
    return fn(projectRoot);
  } finally {
    if (previous === undefined) delete process.env.PROJECT_MEMORY_PROJECT_ROOT;
    else process.env.PROJECT_MEMORY_PROJECT_ROOT = previous;
  }
}

test('records and returns the structured result of a reconciliation', () => withProjectRoot((projectRoot) => {
  mkdirSync(path.join(projectRoot, '.memory'), { recursive: true });
  const report = {
    summary: 'Consolidated current CLI conventions.',
    reviewed: 7,
    changes: [{ action: 'updated', memory_id: 'cli-conventions', summary: 'Added the usage command convention.' }],
    unresolved: ['Confirm provider cost fields for every gateway.'],
  };
  const status = recordReconciliation('project', report, new Date('2026-08-04T12:00:00.000Z'));

  assert.deepEqual(status.report, report);
  const written = JSON.parse(readFileSync(path.join(projectRoot, '.memory', 'maintenance', 'reconciliation.json'), 'utf8'));
  assert.equal(written.version, 2);
  assert.deepEqual(written.report, report);
}));

test('keeps timestamp-only reconciliation records readable', () => withProjectRoot((projectRoot) => {
  const maintenance = path.join(projectRoot, '.memory', 'maintenance');
  mkdirSync(maintenance, { recursive: true });
  writeFileSync(path.join(maintenance, 'reconciliation.json'), `${JSON.stringify({ version: 1, last_reconciled_at: '2026-08-01T12:00:00.000Z' })}\n`);

  const status = getReconciliationStatus('project', new Date('2026-08-04T12:00:00.000Z'));
  assert.equal(status.last_reconciled_at, '2026-08-01T12:00:00.000Z');
  assert.equal(status.report, null);
}));
