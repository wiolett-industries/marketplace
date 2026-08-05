import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';
import { evaluateMemoryWrite } from '../dist/gate/write-gate.js';
import { resetModelProvider } from '../dist/model-provider.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rootReadme = path.join(repoRoot, 'README.md');
const memorySkill = path.join(repoRoot, 'plugins/agent-memory/skills/using-agent-memory/SKILL.md');
const memoryOperations = path.join(repoRoot, 'plugins/agent-memory/skills/using-agent-memory/references/operations.md');
const reconciliationSkill = path.join(repoRoot, 'plugins/agent-memory/skills/reconciling-memory/SKILL.md');

async function withMockedProvider(fn) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousConfigPath = process.env.WIOLETT_AUTH_CONFIG_PATH;
  const previousAgentsHome = process.env.PROJECT_MEMORY_AGENTS_HOME;
  const agentsHome = mkdtempSync(path.join(os.tmpdir(), 'agent-memory-gate-home-'));
  const configDir = path.join(agentsHome, '.wiolett', 'config');
  mkdirSync(configDir, { recursive: true });
  writeFileSync(path.join(configDir, 'ai-providers.yml'), `version: 1
providers:
  openai:
    driver: openai
    base_url: https://api.openai.com/v1
    auth: { api_key: sk-test-gate }
    apis:
      responses: { path: /responses, store: false }
      embeddings: { path: /embeddings }
    defaults:
      text_api: responses
      models: { text: gpt-5-mini, embeddings: text-embedding-3-small }
`, 'utf8');
  writeFileSync(path.join(configDir, 'mcp-config.yml'), `version: 1
mcp:
  agent-memory:
    routing:
      embeddings: { provider: openai, api: embeddings }
      gate: { provider: openai, api: responses }
      synthesis: { provider: openai, api: responses }
`, 'utf8');
  delete process.env.OPENAI_API_KEY;
  delete process.env.WIOLETT_AUTH_CONFIG_PATH;
  process.env.PROJECT_MEMORY_AGENTS_HOME = agentsHome;
  resetModelProvider();

  try {
    return await fn();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousConfigPath === undefined) delete process.env.WIOLETT_AUTH_CONFIG_PATH;
    else process.env.WIOLETT_AUTH_CONFIG_PATH = previousConfigPath;
    if (previousAgentsHome === undefined) delete process.env.PROJECT_MEMORY_AGENTS_HOME;
    else process.env.PROJECT_MEMORY_AGENTS_HOME = previousAgentsHome;
    resetModelProvider();
  }
}

describe('memory write gate', () => {
  test('memory skill keeps a focused startup and durable write contract', () => {
    const skill = readFileSync(memorySkill, 'utf8');
    const operations = readFileSync(memoryOperations, 'utf8');
    const reconciliation = readFileSync(reconciliationSkill, 'utf8');
    const readme = readFileSync(rootReadme, 'utf8');

    expect(skill).toMatch(/^name: using-agent-memory$/m);
    expect(skill).toMatch(/Do not wait for the user to explicitly ask for memory/);
    expect(skill).toMatch(/Use `memory_recap` when the task needs broad recovery/);
    expect(skill).toMatch(/Never use `memory_recall` as the first semantic search or startup recall/);
    expect(skill).toMatch(/memory_reconciliation_status/);
    expect(skill).toMatch(/memory_reconciliation_record/);
    expect(skill).toMatch(/Skip the MCP read only for self-contained facts/);
    expect(skill).toMatch(/read-only, no edits, without changes/);
    expect(skill).toMatch(/run one mandatory memory completion latch/);
    expect(skill).toMatch(/without waiting for an explicit "remember this" request/);
    expect(skill).toMatch(/Planning discussion, speculative direction, raw progress/);
    expect(skill).toMatch(/raw session summaries/);
    expect(skill).toMatch(/Prefer `memory_update` when an existing canonical memory/);
    expect(skill).toMatch(/Use `memory_save` only for a genuinely new durable fact/);
    expect(skill).toMatch(/Preserve negation and ownership exactly/);
    expect(skill).toMatch(/Treat project `\.memory\/` as repository-owned team knowledge/);
    expect(skill).toMatch(/Commit every authorized change under `\.memory\/memories\/`, `\.memory\/index\/`, `\.memory\/embeddings\/`, `\.memory\/graph\/`, and `\.memory\/maintenance\/`/);
    expect(skill).toMatch(/Never add `\.memory\/`, `\.memory\/\*\*`/);
    expect(skill).toMatch(/Ignore only the SQLite cache and its sidecars via `\.memory\/memory\.db\*`/);
    expect(skill).toMatch(/git status --short \.memory/);
    expect(skill).toMatch(/git check-ignore -v/);
    expect(skill).toMatch(/workspace_root/);
    expect(skill).toMatch(/references\/operations\.md/);
    expect(operations).toMatch(/memory_setup/);
    expect(operations).toMatch(/memory_recap/);
    expect(operations).toMatch(/memory_reconciliation_status/);
    expect(operations).toMatch(/memory_reconciliation_record/);
    expect(operations).toMatch(/memory_delete/);
    expect(operations).toMatch(/memory_link/);
    expect(operations).toMatch(/memory_unlink/);
    expect(operations).toMatch(/Omit `index_only` when debugging/);
    expect(operations).toMatch(/Project `\.memory\/` files are repository-owned team knowledge artifacts/);
    expect(operations).toMatch(/Commit every authorized creation, update, or deletion under `\.memory\/memories\/`, `\.memory\/index\/`, `\.memory\/embeddings\/`, `\.memory\/graph\/`, and `\.memory\/maintenance\/`/);
    expect(operations).toMatch(/Never ignore `\.memory\/` wholesale/);
    expect(operations).toMatch(/Ignore only `\.memory\/memory\.db\*`/);
    expect(reconciliation).toMatch(/^name: reconciling-memory$/m);
    expect(reconciliation).toMatch(/memory_reconciliation_status/);
    expect(reconciliation).toMatch(/memory_reconciliation_record/);
    expect(reconciliation).toMatch(/For an ordinary reconciliation, do not delete memories, prune graph edges, or re-embed content/);
    expect(reconciliation).toMatch(/## Full Maintenance/);
    expect(reconciliation).toMatch(/memory_graph_maintain/);
    expect(readme).toMatch(/Project Memory Belongs In Git/);
    expect(readme).toMatch(/Commit memories, indexes, embeddings, graph edges, and reconciliation/);
    expect(readme).toMatch(/Never ignore `\.memory\/` wholesale/);
    expect(readme).toMatch(/\.memory\/memory\.db\*/);
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
      expect(requestBody.instructions).toContain('Default to allow and preserve the submitted content verbatim');
      expect(requestBody.instructions).toContain('Never rewrite solely to improve prose, grammar, formatting');
      expect(requestBody.instructions).toContain('A rewrite must be surgical');
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
