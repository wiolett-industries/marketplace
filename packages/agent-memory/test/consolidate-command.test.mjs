import { describe, expect, test } from '@jest/globals';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCodexArgs, formatReconciliationReport, hasRequiredCodexModel, readCodexConsolidationReport, runConsolidateCommand } from '../dist/cli/consolidate-command.js';

function createUi() {
  const messages = [];
  return {
    messages,
    intro(message) { messages.push(message); },
    info(message) { messages.push(message); },
    note(message) { messages.push(message); },
    cancel(message) { messages.push(message); },
    outro(message) { messages.push(message); },
    async text() { return null; },
    async password() { return null; },
    async select() { return null; },
    async confirm() { return null; },
    spinner() { return { stop(message) { messages.push(message); }, error(message) { messages.push(message); } }; },
  };
}

function supportedModels() {
  return { models: [{ slug: 'gpt-5.6-terra', supported_in_api: true, supported_reasoning_levels: [{ effort: 'high' }] }] };
}

describe('Codex-backed memory consolidation', () => {
  test('requires the exact visible Terra model and high reasoning level', () => {
    expect(hasRequiredCodexModel({
      models: [{ slug: 'gpt-5.6-terra', supported_in_api: true, supported_reasoning_levels: [{ effort: 'high' }] }],
    })).toBe(true);
    expect(hasRequiredCodexModel({
      models: [{ slug: 'gpt-5.6-terra', supported_in_api: true, supported_reasoning_levels: [{ effort: 'medium' }] }],
    })).toBe(false);
    expect(hasRequiredCodexModel({
      models: [{ slug: 'gpt-5.6-terra', supported_in_api: false, supported_reasoning_levels: [{ effort: 'high' }] }],
    })).toBe(false);
  });

  test('formats a durable reconciliation report for the CLI', () => {
    expect(formatReconciliationReport({
      summary: 'Consolidated current memory.',
      reviewed: 4,
      changes: [{ action: 'saved', memory_id: 'usage', summary: 'Saved provider usage policy.' }],
      unresolved: [],
    })).toContain('saved usage: Saved provider usage policy.');
  });

  test('uses the Codex global approval flag before the exec subcommand', () => {
    const args = buildCodexArgs({ scope: 'global', memoryRoot: '/tmp/memory', workingDirectory: '/tmp/memory', status: {} });
    expect(args.slice(0, 5)).toEqual(['--ask-for-approval', 'never', 'exec', '--ephemeral', '--model']);
    expect(args).not.toContain('--ask-for-approval never');
  });

  test('asks Codex for a structured report and keeps recording in the parent CLI', () => {
    const args = buildCodexArgs(
      { scope: 'project', memoryRoot: '/tmp/memory', workingDirectory: '/tmp/project', status: {} },
      '/tmp/report.schema.json',
      '/tmp/report.json',
    );
    expect(args).toContain('--output-schema');
    expect(args).toContain('/tmp/report.schema.json');
    expect(args).toContain('--output-last-message');
    expect(args).toContain('/tmp/report.json');
    expect(args.at(-1)).toContain('Do not call memory_reconciliation_record');
  });

  test('rejects a malformed Codex report before recording reconciliation', () => {
    const reportPath = path.join(mkdtempSync(path.join(tmpdir(), 'agent-memory-report-')), 'report.json');
    try {
      writeFileSync(reportPath, JSON.stringify({ completed: true, summary: 'Missing report fields' }), 'utf8');
      expect(() => readCodexConsolidationReport(reportPath)).toThrow('Codex did not return a valid consolidation report.');
    } finally {
      rmSync(path.dirname(reportPath), { recursive: true, force: true });
    }
  });

  test('records a validated parent-side report after Codex exits successfully', async () => {
    const project = mkdtempSync(path.join(tmpdir(), 'agent-memory-consolidation-project-'));
    const previousCwd = process.cwd();
    mkdirSync(path.join(project, '.memory', 'memories'), { recursive: true });
    process.chdir(project);
    const ui = createUi();
    ui.select = async () => 'project';
    ui.confirm = async () => true;
    try {
      await runConsolidateCommand({
        ui,
        listCodexModels: async () => supportedModels(),
        runCodex: async (args) => {
          const outputPath = args[args.indexOf('--output-last-message') + 1];
          writeFileSync(outputPath, JSON.stringify({
            completed: true,
            summary: 'Consolidated project memory.',
            reviewed: 1,
            changes: [],
            unresolved: [],
          }), 'utf8');
          return 0;
        },
      });
      const record = JSON.parse(readFileSync(path.join(project, '.memory', 'maintenance', 'reconciliation.json'), 'utf8'));
      expect(record.report).toEqual(expect.objectContaining({ summary: 'Consolidated project memory.', reviewed: 1 }));
      expect(ui.messages.join('\n')).toContain('Project memory consolidation completed');
    } finally {
      process.chdir(previousCwd);
      rmSync(project, { recursive: true, force: true });
    }
  });

  test('does not record reconciliation when Codex exits without a valid report', async () => {
    const project = mkdtempSync(path.join(tmpdir(), 'agent-memory-consolidation-project-'));
    const previousCwd = process.cwd();
    mkdirSync(path.join(project, '.memory', 'memories'), { recursive: true });
    process.chdir(project);
    const ui = createUi();
    ui.select = async () => 'project';
    ui.confirm = async () => true;
    try {
      await runConsolidateCommand({
        ui,
        listCodexModels: async () => supportedModels(),
        runCodex: async (args) => {
          const outputPath = args[args.indexOf('--output-last-message') + 1];
          writeFileSync(outputPath, JSON.stringify({ completed: true, summary: 'Incomplete' }), 'utf8');
          return 0;
        },
      });
      expect(() => readFileSync(path.join(project, '.memory', 'maintenance', 'reconciliation.json'), 'utf8')).toThrow();
      expect(ui.messages.join('\n')).toContain('Memory consolidation did not complete');
    } finally {
      process.chdir(previousCwd);
      rmSync(project, { recursive: true, force: true });
    }
  });

  test('authorizes complete maintenance rather than a one-change-only review', () => {
    const args = buildCodexArgs({ scope: 'project', memoryRoot: '/tmp/memory', workingDirectory: '/tmp/project', status: {} });
    const prompt = args.at(-1);
    expect(prompt).toContain('full Agent Memory maintenance reconciliation');
    expect(prompt).toContain('memory_graph_maintain with dry_run=false');
    expect(prompt).toContain('orphan graph files');
    expect(prompt).toContain('model reasoning for semantic maintenance');
    expect(prompt).toContain('saved/updated/deleted/repaired');
    expect(prompt).not.toContain('Do not delete memories, prune graph edges');
  });

  test('does not offer a run when Codex capability discovery fails', async () => {
    const ui = createUi();
    await runConsolidateCommand({
      ui,
      listCodexModels: async () => ({ models: [] }),
    });
    expect(ui.messages.join('\n')).toContain('No initialized project or global memory scope is eligible');
  });
});
