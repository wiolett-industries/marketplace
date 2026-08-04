import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { extractUsage, formatUsageSummary, getUsageLogPath, readUsageSummary, recordProviderUsage } from '../dist/usage.js';

test('extracts OpenAI-compatible usage and provider-reported cost', () => {
  assert.deepEqual(extractUsage({
    usage: {
      input_tokens: 120,
      output_tokens: 30,
      total_tokens: 150,
      input_tokens_details: { cached_tokens: 20 },
      cost_usd: 0.0015,
    },
  }), {
    input_tokens: 120,
    output_tokens: 30,
    total_tokens: 150,
    cached_tokens: 20,
    cost_usd: 0.0015,
  });
  assert.deepEqual(extractUsage({ usage: { prompt_tokens: 20, completion_tokens: 5, total_cost: 0.002 } }), {
    input_tokens: 20,
    output_tokens: 5,
    total_tokens: 25,
    cost_usd: 0.002,
  });
});

test('writes metadata-only local usage records and renders a compact model summary', () => {
  const agentsHome = mkdtempSync(path.join(tmpdir(), 'agent-memory-usage-'));
  const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome };
  recordProviderUsage({
    provider: 'gateway',
    model: 'gpt-test',
    role: 'synthesis',
    api: 'responses',
    env,
    response: { usage: { input_tokens: 200, output_tokens: 50, total_tokens: 250, cost: 0.003 } },
  });
  recordProviderUsage({
    provider: 'gateway',
    model: 'embed-test',
    role: 'embeddings',
    api: 'embeddings',
    env,
    response: { usage: { prompt_tokens: 100, total_tokens: 100 } },
  });

  const logPath = getUsageLogPath(env);
  const serialized = readFileSync(logPath, 'utf8');
  assert.equal(serialized.includes('sk-'), false);
  assert.equal(serialized.includes('input_tokens'), true);

  const summary = readUsageSummary({ logPath });
  assert.equal(summary.total.calls, 2);
  assert.equal(summary.total.totalTokens, 350);
  assert.equal(summary.total.costUsd, 0.003);
  assert.match(formatUsageSummary(summary), /gateway \/ gpt-test: 1 calls/);
  assert.match(formatUsageSummary(summary), /\$0\.003/);
});
