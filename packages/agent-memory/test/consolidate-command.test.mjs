import { describe, expect, test } from '@jest/globals';
import { buildCodexArgs, formatReconciliationReport, hasRequiredCodexModel, runConsolidateCommand } from '../dist/cli/consolidate-command.js';

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

  test('does not offer a run when Codex capability discovery fails', async () => {
    const ui = createUi();
    await runConsolidateCommand({
      ui,
      listCodexModels: async () => ({ models: [] }),
    });
    expect(ui.messages.join('\n')).toContain('No initialized project or global memory scope is eligible');
  });
});
