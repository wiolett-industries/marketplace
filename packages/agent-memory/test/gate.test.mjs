import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';
import { evaluateMemoryWrite } from '../dist/gate/write-gate.js';
import { resetModelProvider } from '../dist/model-provider.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const memorySkill = path.join(repoRoot, 'plugins/agent-memory/skills/using-agent-memory/SKILL.md');
const memoryOperations = path.join(repoRoot, 'plugins/agent-memory/skills/using-agent-memory/references/operations.md');

async function withMockedProvider(fn) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousConfigPath = process.env.WIOLETT_AUTH_CONFIG_PATH;
  process.env.OPENAI_API_KEY = 'sk-test-gate';
  process.env.WIOLETT_AUTH_CONFIG_PATH = '/tmp/agent-memory-missing-gate-config.json';
  resetModelProvider();

  try {
    return await fn();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousConfigPath === undefined) delete process.env.WIOLETT_AUTH_CONFIG_PATH;
    else process.env.WIOLETT_AUTH_CONFIG_PATH = previousConfigPath;
    resetModelProvider();
  }
}

describe('memory write gate', () => {
  test('memory skill keeps a focused startup and durable write contract', () => {
    const skill = readFileSync(memorySkill, 'utf8');
    const operations = readFileSync(memoryOperations, 'utf8');

    expect(skill).toMatch(/^name: using-agent-memory$/m);
    expect(skill).toMatch(/Do not wait for the user to explicitly ask for memory/);
    expect(skill).toMatch(/Use `memory_recap` when the task needs broad recovery/);
    expect(skill).toMatch(/Skip the MCP read only for self-contained facts/);
    expect(skill).toMatch(/read-only, no edits, without changes/);
    expect(skill).toMatch(/run one mandatory memory completion latch/);
    expect(skill).toMatch(/without waiting for an explicit "remember this" request/);
    expect(skill).toMatch(/Planning discussion, speculative direction, raw progress/);
    expect(skill).toMatch(/raw session summaries/);
    expect(skill).toMatch(/Prefer `memory_update` when an existing canonical memory/);
    expect(skill).toMatch(/Use `memory_save` only for a genuinely new durable fact/);
    expect(skill).toMatch(/Preserve negation and ownership exactly/);
    expect(skill).toMatch(/workspace_root/);
    expect(skill).toMatch(/references\/operations\.md/);
    expect(operations).toMatch(/memory_setup/);
    expect(operations).toMatch(/memory_recap/);
    expect(operations).toMatch(/memory_delete/);
    expect(operations).toMatch(/memory_link/);
    expect(operations).toMatch(/memory_unlink/);
    expect(operations).toMatch(/Omit `index_only` when debugging/);
    expect(operations).toMatch(/Project `\.memory\/` files are team knowledge artifacts/);
    expect(operations).toMatch(/Commit canonical files under `\.memory\/memories\/`, `\.memory\/index\/`, `\.memory\/embeddings\/`, and `\.memory\/graph\/`/);
    expect(operations).toMatch(/Only `\.memory\/memory\.db\*` is generated cache/);
  });

  test('uses strict structured output schema that is accepted by OpenAI-compatible providers', async () => {
    await withMockedProvider(async () => {
      let requestBody;
      globalThis.fetch = async (_url, init) => {
        requestBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          output_text: JSON.stringify({
            decision: 'rewrite',
            reason: 'Durable project workflow.',
            normalized_content: 'Normalized durable workflow.',
            suggested_scope: null,
            suggested_tags: ['workflow'],
            confidence: 0.9,
            importance: 0.8,
          }),
        }), { status: 200 });
      };

      const result = await evaluateMemoryWrite({
        content: 'Durable workflow',
        tags: ['workflow'],
        scope: 'project',
        operation: 'save',
      });

      expect(result).toEqual(expect.objectContaining({
        decision: 'rewrite',
        normalized_content: 'Normalized durable workflow.',
        suggested_tags: ['workflow'],
      }));
      expect(requestBody.model).toBe('gpt-5-mini');
      expect(requestBody.instructions).toContain('Allow distilled durable lessons from completed work');
      expect(requestBody.instructions).toContain('Reject planning-stage product decisions');
      expect(requestBody.instructions).toContain('Prefer updating an existing memory');
      expect(requestBody.instructions).toContain('preserve meaning exactly, especially negation');
      expect(requestBody.instructions).toContain('raw transcripts');
      expect(requestBody.text.format.schema.required).toEqual([
        'decision',
        'reason',
        'normalized_content',
        'suggested_scope',
        'suggested_tags',
        'confidence',
        'importance',
      ]);
    });
  });

  test('does not apply rewrites that drop negation', async () => {
    await withMockedProvider(async () => {
      globalThis.fetch = async () => new Response(JSON.stringify({
        output_text: JSON.stringify({
          decision: 'rewrite',
          reason: 'Useful model behavior preference.',
          normalized_content: 'The planning agent owned product decisions during planning.',
          suggested_scope: null,
          suggested_tags: ['workflow'],
          confidence: 0.9,
          importance: 0.8,
        }),
      }), { status: 200 });

      const result = await evaluateMemoryWrite({
        content: 'The planning agent must not own product decisions during planning.',
        tags: ['workflow'],
        scope: 'global',
        operation: 'update',
      });

      expect(result.decision).toBe('allow');
      expect(result.normalized_content).toBeUndefined();
      expect(result.reason).toMatch(/Rewrite discarded/);
      expect(result.confidence).toBeLessThanOrEqual(0.55);
    });
  });
});
