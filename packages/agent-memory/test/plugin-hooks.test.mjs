import { mkdtempSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hookScript = path.join(repoRoot, 'plugins/agent-memory/hooks/agent-memory-hook.cjs');

function runHook(input, cwd = repoRoot) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'agent-memory-hook-home-'));
  const result = spawnSync(process.execPath, [hookScript], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      OPENAI_API_KEY: '',
    },
  });
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  return result.stdout.trim() ? JSON.parse(result.stdout) : {};
}

describe('agent-memory plugin hooks', () => {
  test('session hook emits setup and skill context', () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'agent-memory-hook-'));
    const output = runHook({ hook_event_name: 'SessionStart', cwd: workspace }, workspace);

    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toMatch(/using-agent-memory/);
    expect(output.hookSpecificOutput.additionalContext).toMatch(/agent-memory@latest init/);
    expect(output.hookSpecificOutput.additionalContext).toMatch(/reads no-op/);
  });

  test('post-compact hook notices existing project memory', () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'agent-memory-hook-'));
    mkdirSync(path.join(workspace, '.memory'), { recursive: true });

    const output = runHook({ hook_event_name: 'PostCompact', cwd: workspace }, workspace);

    expect(output.hookSpecificOutput.hookEventName).toBe('PostCompact');
    expect(output.hookSpecificOutput.additionalContext).toMatch(/Project `\.memory\/` exists/);
    expect(output.hookSpecificOutput.additionalContext).toMatch(/PostCompact/);
  });
});
