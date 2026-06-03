import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hookScript = path.join(repoRoot, 'plugins/agent-memory/hooks/agent-memory-hook.cjs');
const hookConfig = path.join(repoRoot, 'plugins/agent-memory/hooks/hooks.json');
const memorySkill = path.join(repoRoot, 'plugins/agent-memory/skills/using-agent-memory/SKILL.md');

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
    expect(output.hookSpecificOutput.additionalContext).toMatch(/Finalizing durable work/);
  });

  test('post-compact hook returns common output fields only', () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'agent-memory-hook-'));
    mkdirSync(path.join(workspace, '.memory'), { recursive: true });

    const output = runHook({ hook_event_name: 'PostCompact', cwd: workspace }, workspace);

    expect(output.continue).toBe(true);
    expect(output.systemMessage).toBeUndefined();
    expect(output.hookSpecificOutput).toBeUndefined();
  });

  test('session hook config does not match compact source', () => {
    const config = JSON.parse(readFileSync(hookConfig, 'utf8'));

    expect(config.hooks.SessionStart[0].matcher).toBe('startup|resume|clear');
  });

  test('memory skill contains positive write triggers', () => {
    const skill = readFileSync(memorySkill, 'utf8');

    expect(skill).toMatch(/Memory writes are expected for durable lessons/);
    expect(skill).toMatch(/Before the final response for non-trivial work/);
    expect(skill).toMatch(/root cause, fix pattern, or architecture decision/);
    expect(skill).toMatch(/raw session recap/);
  });
});
