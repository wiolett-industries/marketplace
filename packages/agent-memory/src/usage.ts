import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getConfigPaths, type ModelRole } from './config.js';

export type UsageApi = 'responses' | 'chat_completions' | 'embeddings';

export type UsageRecord = {
  timestamp: string;
  provider: string;
  model: string;
  role: ModelRole;
  api: UsageApi;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_tokens?: number;
  cost_usd?: number;
};

export type UsageSummary = {
  records: UsageRecord[];
  total: UsageTotals;
  byModel: Array<UsageTotals & { provider: string; model: string }>;
  dailyCalls: Array<{ date: string; calls: number }>;
};

type UsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  costUsd: number;
  costReportedCalls: number;
};

export function getUsageLogPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(getConfigPaths(env).agentsHome, '.wiolett', 'usage.jsonl');
}

export function recordProviderUsage(input: {
  provider: string;
  model: string;
  role: ModelRole;
  api: UsageApi;
  response: unknown;
  env?: NodeJS.ProcessEnv;
}): void {
  const usage = extractUsage(input.response);
  if (!usage) return;
  const record: UsageRecord = {
    timestamp: new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    role: input.role,
    api: input.api,
    ...usage,
  };
  try {
    const usagePath = getUsageLogPath(input.env);
    mkdirSync(path.dirname(usagePath), { recursive: true, mode: 0o700 });
    appendFileSync(usagePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
    chmodSync(usagePath, 0o600);
  } catch {
    // Usage accounting must never turn a successful provider request into an application failure.
  }
}

export function readUsageSummary(options: { days?: number; now?: Date; logPath?: string } = {}): UsageSummary {
  const now = options.now ?? new Date();
  const days = options.days ?? 30;
  const logPath = options.logPath ?? getUsageLogPath();
  const earliest = now.getTime() - days * 24 * 60 * 60 * 1_000;
  const records = readUsageRecords(logPath).filter((record) => Date.parse(record.timestamp) >= earliest);
  const total = emptyTotals();
  const byModel = new Map<string, UsageTotals & { provider: string; model: string }>();
  const dailyCalls = new Map<string, number>();
  for (const record of records) {
    addRecord(total, record);
    const key = `${record.provider}\u0000${record.model}`;
    const aggregate = byModel.get(key) ?? { provider: record.provider, model: record.model, ...emptyTotals() };
    addRecord(aggregate, record);
    byModel.set(key, aggregate);
    const date = record.timestamp.slice(0, 10);
    dailyCalls.set(date, (dailyCalls.get(date) ?? 0) + 1);
  }
  return {
    records,
    total,
    byModel: [...byModel.values()].sort((left, right) => right.totalTokens - left.totalTokens || right.calls - left.calls),
    dailyCalls: [...dailyCalls].map(([date, calls]) => ({ date, calls })).sort((left, right) => left.date.localeCompare(right.date)),
  };
}

export function formatUsageSummary(summary: UsageSummary, options: { days?: number; now?: Date } = {}): string {
  const days = options.days ?? 30;
  if (!summary.records.length) {
    return `No model usage was recorded in the last ${days} days. Usage is recorded from successful provider responses that include a usage field.`;
  }
  const recentCalls = callsForRecentDays(summary.dailyCalls, options.now ?? new Date(), 14);
  const lines = [
    `Last ${days} days`,
    `Calls: ${summary.total.calls}`,
    `Tokens: ${formatNumber(summary.total.inputTokens)} input · ${formatNumber(summary.total.outputTokens)} output · ${formatNumber(summary.total.totalTokens)} total`,
    `Cost: ${summary.total.costReportedCalls ? `${formatUsd(summary.total.costUsd)} (reported by ${summary.total.costReportedCalls}/${summary.total.calls} calls)` : 'not reported by provider'}`,
    `14-day calls: ${sparkline(recentCalls)}`,
    '',
    'By model',
    ...summary.byModel.map((row) => `${row.provider} / ${row.model}: ${row.calls} calls · ${formatNumber(row.totalTokens)} tokens${row.costReportedCalls ? ` · ${formatUsd(row.costUsd)}` : ''}`),
  ];
  return lines.join('\n');
}

export function extractUsage(response: unknown): Omit<UsageRecord, 'timestamp' | 'provider' | 'model' | 'role' | 'api'> | null {
  const payload = recordOf(response);
  const usage = recordOf(payload?.usage);
  if (!usage) return null;
  const inputTokens = numberOf(usage.input_tokens) ?? numberOf(usage.prompt_tokens);
  const outputTokens = numberOf(usage.output_tokens) ?? numberOf(usage.completion_tokens);
  const totalTokens = numberOf(usage.total_tokens) ?? (inputTokens !== undefined || outputTokens !== undefined
    ? (inputTokens ?? 0) + (outputTokens ?? 0)
    : undefined);
  const cachedTokens = numberOf(recordOf(usage.input_tokens_details)?.cached_tokens)
    ?? numberOf(recordOf(usage.prompt_tokens_details)?.cached_tokens);
  const costUsd = numberOf(usage.cost_usd)
    ?? numberOf(usage.total_cost_usd)
    ?? numberOf(usage.cost)
    ?? numberOf(usage.total_cost);
  if ([inputTokens, outputTokens, totalTokens, cachedTokens, costUsd].every((value) => value === undefined)) return null;
  return {
    ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
    ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
    ...(totalTokens !== undefined ? { total_tokens: totalTokens } : {}),
    ...(cachedTokens !== undefined ? { cached_tokens: cachedTokens } : {}),
    ...(costUsd !== undefined ? { cost_usd: costUsd } : {}),
  };
}

function readUsageRecords(logPath: string): UsageRecord[] {
  if (!existsSync(logPath)) return [];
  try {
    return readFileSync(logPath, 'utf8').split('\n').flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        return isUsageRecord(parsed) ? [parsed] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function isUsageRecord(value: unknown): value is UsageRecord {
  const record = recordOf(value);
  return Boolean(record
    && typeof record.timestamp === 'string'
    && typeof record.provider === 'string'
    && typeof record.model === 'string'
    && (record.role === 'gate' || record.role === 'synthesis' || record.role === 'embeddings')
    && (record.api === 'responses' || record.api === 'chat_completions' || record.api === 'embeddings'));
}

function emptyTotals(): UsageTotals {
  return { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0, costUsd: 0, costReportedCalls: 0 };
}

function addRecord(target: UsageTotals, record: UsageRecord): void {
  target.calls += 1;
  target.inputTokens += record.input_tokens ?? 0;
  target.outputTokens += record.output_tokens ?? 0;
  target.totalTokens += record.total_tokens ?? 0;
  target.cachedTokens += record.cached_tokens ?? 0;
  if (record.cost_usd !== undefined) {
    target.costUsd += record.cost_usd;
    target.costReportedCalls += 1;
  }
}

function callsForRecentDays(dailyCalls: UsageSummary['dailyCalls'], now: Date, days: number): number[] {
  const byDate = new Map(dailyCalls.map((entry) => [entry.date, entry.calls]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - days + index + 1);
    return byDate.get(date.toISOString().slice(0, 10)) ?? 0;
  });
}

function sparkline(values: number[]): string {
  const max = Math.max(...values, 0);
  if (!max) return '──────────────';
  const glyphs = '▁▂▃▄▅▆▇█';
  return values.map((value) => glyphs[Math.round((value / max) * (glyphs.length - 1))]).join('');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
