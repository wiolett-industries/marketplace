import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { getMemoryRoot, getProjectRoot, type MemoryScope } from '../scope.js';
import { getReconciliationStatus, type ReconciliationReport, type ReconciliationStatus } from '../reconciliation.js';
import type { ConfigCliUi, ConfigOption } from './config-ui.js';

const RECENT_RECONCILIATION_MS = 24 * 60 * 60 * 1000;
const CODEX_MODEL = 'gpt-5.6-terra';
const CODEX_REASONING = 'high';

export interface ConsolidationScopeOption {
  scope: MemoryScope;
  memoryRoot: string;
  workingDirectory: string;
  status: ReconciliationStatus;
}

export interface ConsolidationCommandInput {
  ui: ConfigCliUi;
  now?: () => Date;
  listCodexModels?: () => Promise<unknown>;
  runCodex?: (args: string[], cwd: string) => Promise<number | CodexRunResult>;
}

export type CodexRunResult = { code: number; diagnostic?: string };

export async function getEligibleConsolidationScopes(input: Pick<ConsolidationCommandInput, 'now' | 'listCodexModels'> = {}): Promise<ConsolidationScopeOption[]> {
  const now = input.now?.() ?? new Date();
  const models = await (input.listCodexModels ?? listCodexModels)();
  if (!hasRequiredCodexModel(models)) return [];

  const projectRoot = getProjectRoot();
  const candidates: ConsolidationScopeOption[] = [
    { scope: 'project', memoryRoot: getMemoryRoot('project'), workingDirectory: projectRoot, status: getReconciliationStatus('project', now) },
    { scope: 'global', memoryRoot: getMemoryRoot('global'), workingDirectory: getMemoryRoot('global'), status: getReconciliationStatus('global', now) },
  ];
  return candidates.filter((candidate) => candidate.status.initialized
    && existsSync(candidate.memoryRoot)
    && !wasReconciledRecently(candidate.status, now));
}

export async function runConsolidateCommand(input: ConsolidationCommandInput): Promise<void> {
  const eligibilitySpinner = input.ui.spinner('Checking whether memory consolidation is available...');
  let scopes: ConsolidationScopeOption[];
  try {
    scopes = await getEligibleConsolidationScopes(input);
    eligibilitySpinner.stop(scopes.length ? 'Memory consolidation is available' : 'Memory consolidation is not currently available');
  } catch {
    eligibilitySpinner.error('Could not verify Codex consolidation availability');
    input.ui.info(`Consolidation requires a working Codex CLI with ${CODEX_MODEL} (${CODEX_REASONING}) available.`);
    return;
  }
  if (!scopes.length) {
    input.ui.info('No initialized project or global memory scope is eligible. Each scope is hidden for 24 hours after a completed reconciliation.');
    return;
  }

  const selected = scopes.length === 1
    ? scopes[0]
    : await selectScope(input.ui, scopes);
  if (!selected) return;
  const confirmed = await input.ui.confirm(`Run full maintenance for ${selected.scope} memory with local Codex? It may update, split, create, or remove redundant durable memories and repair automatic graph artifacts; manual links stay protected.`, false);
  if (confirmed !== true) return;

  const startedAt = (input.now?.() ?? new Date()).getTime();
  const spinner = input.ui.spinner(`Consolidating ${selected.scope} memory with Codex...`);
  try {
    const outcome = await (input.runCodex ?? runCodex)(buildCodexArgs(selected), selected.workingDirectory);
    const result = typeof outcome === 'number' ? { code: outcome } : outcome;
    if (result.code !== 0) throw new Error(`Codex exited unsuccessfully.${result.diagnostic ? ` ${result.diagnostic}` : ''}`);
    const updated = getReconciliationStatus(selected.scope);
    if (!updated.last_reconciled_at || Date.parse(updated.last_reconciled_at) < startedAt - 5_000) {
      throw new Error('Codex completed without recording the reconciliation.');
    }
    if (!updated.report) throw new Error('Codex completed without recording a reconciliation report.');
    spinner.stop(`${selected.scope === 'project' ? 'Project' : 'Global'} memory consolidation completed`);
    input.ui.note(formatReconciliationReport(updated.report), 'Consolidation result');
  } catch (error) {
    spinner.error('Memory consolidation did not complete');
    input.ui.info(error instanceof Error ? error.message : String(error));
  }
}

export function hasRequiredCodexModel(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { models?: unknown }).models)) return false;
  const model = (value as { models: unknown[] }).models.find((candidate) => isRecord(candidate) && candidate.slug === CODEX_MODEL);
  return isRecord(model)
    && model.supported_in_api === true
    && Array.isArray(model.supported_reasoning_levels)
    && model.supported_reasoning_levels.some((level) => isRecord(level) && level.effort === CODEX_REASONING);
}

function wasReconciledRecently(status: ReconciliationStatus, now: Date): boolean {
  return Boolean(status.last_reconciled_at) && now.getTime() - Date.parse(status.last_reconciled_at!) < RECENT_RECONCILIATION_MS;
}

async function selectScope(ui: ConfigCliUi, scopes: ConsolidationScopeOption[]): Promise<ConsolidationScopeOption | null> {
  const value = await ui.select('Memory scope to consolidate', scopes.map((scope) => ({
    value: scope.scope,
    label: scope.scope === 'project' ? 'Project memory' : 'Global memory',
    hint: scope.memoryRoot,
  } satisfies ConfigOption)));
  return scopes.find((scope) => scope.scope === value) ?? null;
}

export function buildCodexArgs(scope: ConsolidationScopeOption): string[] {
  const prompt = [
    `Perform exactly one user-approved full Agent Memory maintenance reconciliation for the ${scope.scope} scope.`,
    `Target memory root: ${scope.memoryRoot}.`,
    'The CLI confirmation explicitly authorizes the Full Maintenance mode in the installed reconciling-memory skill. Do not stop after one easy update: complete every safe, evidence-backed maintenance action in this scope.',
    'Read reconciliation status, run one broad memory recap, inspect all durable records and graph health before making changes. Consolidate duplicates and superseded records into canonical memories; split mixed memories or save a new canonical memory when this preserves distinct durable facts or reveals a stable cross-memory pattern.',
    'Delete a canonical memory only after its durable value has been preserved elsewhere and it is proven duplicate, superseded, stale, wrongly scoped, or secret-bearing. Do not delete ambiguous memories, invent facts, alter unrelated repository files, re-embed content, or remove structurally valid manual graph edges.',
    'First call memory_graph_maintain with dry_run=false for deterministic cleanup: delete dead index pointers, orphan graph files, and structurally impossible edges, then rebuild AUTO links. It preserves valid manual links. Inspect graph health afterwards. Use your model reasoning for semantic maintenance—deciding which memories or remaining healthy relationships should be merged, split, created, updated, or removed—rather than treating structural repair as a substitute for that review.',
    'After the scoped work is actually complete, call memory_reconciliation_record for this exact scope with a concise secret-free summary, reviewed count when known, every saved/updated/deleted/repaired result in changes, and every unresolved conflict in unresolved. This structured report is required for CLI success and will be shown to the user.',
    'For project memory, inspect the resulting .memory changes. Give a concise final report with the same changes, post-maintenance graph health, and unresolved conflicts.',
  ].join('\n');
  return [
    '--ask-for-approval', 'never', 'exec', '--ephemeral', '--model', CODEX_MODEL,
    '-c', `model_reasoning_effort = "${CODEX_REASONING}"`,
    '--sandbox', 'workspace-write', '--cd', scope.workingDirectory,
    ...(scope.scope === 'global' ? ['--skip-git-repo-check'] : []),
    prompt,
  ];
}

export function formatReconciliationReport(report: ReconciliationReport): string {
  return [
    report.summary,
    ...(report.reviewed !== undefined ? ['', `Reviewed: ${report.reviewed} memories`] : []),
    '',
    'Changes',
    ...(report.changes.length
      ? report.changes.map((change) => `• ${change.action}${change.memory_id ? ` ${change.memory_id}` : ''}: ${change.summary}`)
      : ['• No durable memory changes were needed.']),
    '',
    'Unresolved',
    ...(report.unresolved.length ? report.unresolved.map((item) => `• ${item}`) : ['• None.']),
  ].join('\n');
}

function listCodexModels(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['debug', 'models'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    const timer = setTimeout(() => child.kill(), 10_000);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error('Codex model catalog command failed.'));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Codex model catalog was invalid.')); }
    });
  });
}

function runCodex(args: string[], cwd: string): Promise<CodexRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr = `${stderr}${chunk.toString()}`.slice(-2_000); });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code: code ?? 1, ...(stderr.trim() ? { diagnostic: sanitizeDiagnostic(stderr) } : {}) }));
  });
}

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(-1_200);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
