import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ConfigCliUi } from './config-ui.js';

const MARKETPLACE = 'wiolett-industries';
const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/wiolett-industries/marketplace/main';

const PRODUCTS = [
  {
    id: 'agent-memory',
    packageName: '@wiolett/agent-memory',
    skills: ['using-agent-memory', 'reconciling-memory'],
  },
  {
    id: 'workflow',
    packageName: '@wiolett/workflow',
    skills: ['audit-flow', 'context-discovery', 'executing-plans', 'finalizing-plan', 'intent-gate', 'ui-contract', 'using-workflow', 'workflow-mcp', 'writing-plans'],
  },
  {
    id: 'merge-request-review',
    packageName: '@wiolett/merge-request-review',
    skills: ['review-merge-request'],
  },
] as const;

type Product = typeof PRODUCTS[number];
type ProductId = Product['id'];

export interface DoctorIssue {
  severity: 'warning' | 'error';
  title: string;
  detail: string;
  fix?: string;
}

export interface DoctorReport {
  githubVersions: Partial<Record<ProductId, string>>;
  codexPlugins: Partial<Record<ProductId, { version: string; enabled: boolean }>>;
  codexSkills: Partial<Record<ProductId, CodexSkillCache>>;
  codexMcp: Partial<Record<ProductId, { enabled: boolean; expectedCommand: boolean }>>;
  claudePlugins: Partial<Record<ProductId, { version: string; scope?: string }>>;
  notes: string[];
  issues: DoctorIssue[];
}

export interface DoctorCommandInput {
  ui: ConfigCliUi;
  fetch?: typeof globalThis.fetch;
  runCommand?: (command: string, args: string[]) => CommandResult;
  homeDirectory?: string;
}

export interface CommandResult {
  ok: boolean;
  stdout: string;
}

interface CodexPluginList {
  installed?: Array<{
    name?: string;
    version?: string;
    enabled?: boolean;
    marketplaceName?: string;
  }>;
}

interface CodexMcpConfig {
  enabled?: boolean;
  transport?: { type?: string; command?: string; args?: string[] };
}

interface ClaudePluginRecord {
  version?: string;
  scope?: string;
}

interface ClaudeInstalledPlugins {
  plugins?: Record<string, ClaudePluginRecord[]>;
}

interface CachedPluginManifest {
  version?: unknown;
}

export interface CodexSkillCache {
  expected: number;
  cached: number;
  missing: string[];
  invalid: string[];
}

export async function runDoctorCommand(input: DoctorCommandInput): Promise<DoctorReport> {
  const spinner = input.ui.spinner('Checking marketplace releases and local integrations...');
  const report = await collectDoctorReport(input);
  if (report.issues.length) spinner.stop(`${report.issues.length} action${report.issues.length === 1 ? '' : 's'} need attention`);
  else spinner.stop('Everything is current');
  input.ui.note(formatDoctorReport(report), 'Agent Memory Doctor');
  return report;
}

export async function collectDoctorReport(input: Omit<DoctorCommandInput, 'ui'>): Promise<DoctorReport> {
  const fetcher = input.fetch ?? globalThis.fetch;
  const runCommand = input.runCommand ?? runLocalCommand;
  const homeDirectory = input.homeDirectory ?? homedir();
  const issues: DoctorIssue[] = [];
  const notes: string[] = [];
  const githubVersions = await readGithubVersions(fetcher, issues);
  const codexPlugins = readCodexPlugins(runCommand, issues);
  const codexSkills = readCodexSkillCaches(homeDirectory, codexPlugins, issues, notes);
  const codexMcp = readCodexMcp(runCommand, issues);
  const claudePlugins = readClaudePlugins(homeDirectory, notes);

  for (const product of PRODUCTS) {
    const githubVersion = githubVersions[product.id];
    const codexPlugin = codexPlugins[product.id];
    if (codexPlugin && !codexPlugin.enabled) {
      issues.push({
        severity: 'error',
        title: `Codex plugin ${product.id} is disabled`,
        detail: 'It is installed but Codex will not load its skills or hooks.',
        fix: `codex plugin remove ${product.id}@${MARKETPLACE} && codex plugin add ${product.id}@${MARKETPLACE}`,
      });
    }
    if (githubVersion && codexPlugin && compareVersions(codexPlugin.version, githubVersion) < 0) {
      issues.push({
        severity: 'warning',
        title: `Codex plugin ${product.id} is behind`,
        detail: `Installed ${codexPlugin.version}; GitHub main advertises ${githubVersion}.`,
        fix: `codex plugin marketplace upgrade ${MARKETPLACE}`,
      });
    }

    const claudePlugin = claudePlugins[product.id];
    if (githubVersion && claudePlugin && compareVersions(claudePlugin.version, githubVersion) < 0) {
      issues.push({
        severity: 'warning',
        title: `Claude plugin ${product.id} is behind`,
        detail: `Installed ${claudePlugin.version}; GitHub main advertises ${githubVersion}.`,
        fix: `claude plugin update ${product.id}@${MARKETPLACE}${claudePlugin.scope ? ` --scope ${claudePlugin.scope}` : ''}`,
      });
    }

    const mcp = codexMcp[product.id];
    if (!mcp) {
      if (codexPlugin?.enabled) {
        issues.push({
          severity: 'error',
          title: `Codex MCP ${product.id} is not configured`,
          detail: 'The plugin is enabled but its MCP server cannot be started.',
          fix: `codex mcp add ${product.id} -- npx -y ${product.packageName}@latest`,
        });
      }
      continue;
    }
    if (!mcp.enabled) {
      issues.push({
        severity: 'error',
        title: `Codex MCP ${product.id} is disabled`,
        detail: 'Its configuration exists but Codex will not start it.',
        fix: replacementMcpCommand(product),
      });
    } else if (!mcp.expectedCommand) {
      issues.push({
        severity: 'warning',
        title: `Codex MCP ${product.id} does not target @latest`,
        detail: `Expected npx -y ${product.packageName}@latest.`,
        fix: replacementMcpCommand(product),
      });
    }
  }

  return { githubVersions, codexPlugins, codexSkills, codexMcp, claudePlugins, notes, issues };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  const claudeBehind = report.issues.filter((issue) => issue.title.startsWith('Claude plugin ') && issue.title.endsWith(' is behind'));
  const codexBehind = report.issues.filter((issue) => issue.title.startsWith('Codex plugin ') && issue.title.endsWith(' is behind'));
  const skillCacheIssues = report.issues.filter((issue) => issue.title.startsWith('Codex skill cache '));
  const grouped = new Set([...claudeBehind, ...codexBehind, ...skillCacheIssues]);
  const remainingIssues = report.issues.filter((issue) => !grouped.has(issue));

  if (!report.issues.length) lines.push('Everything is up to date.');
  else {
    lines.push(`${report.issues.length} action${report.issues.length === 1 ? '' : 's'} need attention`);
    if (claudeBehind.length) {
      lines.push('', 'Update Claude Code plugins');
      for (const issue of claudeBehind) lines.push(...formatVersionIssue(issue, report.claudePlugins, report.githubVersions, true));
    }
    if (codexBehind.length) {
      lines.push('', 'Update the Codex marketplace');
      for (const issue of codexBehind) lines.push(...formatVersionIssue(issue, report.codexPlugins, report.githubVersions, false));
      lines.push(`  ${codexBehind[0]?.fix}`);
    }
    if (skillCacheIssues.length) {
      lines.push('', 'Refresh cached Codex skills');
      for (const issue of skillCacheIssues) lines.push(...formatSkillCacheIssue(issue, report.codexSkills));
    }
    if (remainingIssues.length) {
      lines.push('', 'Other fixes');
      for (const issue of remainingIssues) {
        lines.push(`• ${issue.title}`);
        lines.push(`  ${issue.detail}`);
        if (issue.fix) lines.push(`  ${issue.fix}`);
      }
    }
  }

  lines.push('', 'Current state');
  lines.push(`✓ ${formatCodexPluginStatus(report)}`);
  lines.push(`✓ ${formatCodexSkillStatus(report)}`);
  lines.push(`✓ ${formatCodexMcpStatus(report)}`);
  lines.push(`✓ ${formatClaudePluginStatus(report, claudeBehind.length)}`);
  if (report.notes.length) lines.push(...report.notes.map((note) => `• ${note}`));
  lines.push('', `GitHub main: ${PRODUCTS.map((product) => `${displayName(product.id)} ${report.githubVersions[product.id] ?? 'unavailable'}`).join(' · ')}`);
  lines.push('This is a read-only check; commands above are suggestions, not automatic fixes.');
  return lines.join('\n');
}

function formatSkillCacheIssue(issue: DoctorIssue, caches: Partial<Record<ProductId, CodexSkillCache>>): string[] {
  const product = productFromTitle(issue.title);
  if (!product) return [`• ${issue.title}`, `  ${issue.detail}`, ...(issue.fix ? [`  ${issue.fix}`] : [])];
  const cache = caches[product];
  if (!cache) return [`• ${displayName(product)}: cache unavailable`, ...(issue.fix ? [`  ${issue.fix}`] : [])];
  const missing = [...cache.missing, ...cache.invalid];
  return [
    `• ${displayName(product)}: ${cache.cached} / ${cache.expected} skills cached`,
    ...(missing.length ? [`  Missing or invalid: ${missing.join(', ')}`] : []),
    ...(issue.fix ? [`  ${issue.fix}`] : []),
  ];
}

function formatVersionIssue(
  issue: DoctorIssue,
  installed: Partial<Record<ProductId, { version: string; enabled?: boolean; scope?: string }>>,
  githubVersions: Partial<Record<ProductId, string>>,
  includeFix: boolean,
): string[] {
  const product = productFromTitle(issue.title);
  if (!product) return [`• ${issue.title}`, `  ${issue.detail}`, ...(includeFix && issue.fix ? [`  ${issue.fix}`] : [])];
  const version = installed[product]?.version ?? 'not detected';
  const githubVersion = githubVersions[product] ?? 'unavailable';
  return [`• ${displayName(product)}: ${version} → ${githubVersion}`, ...(includeFix && issue.fix ? [`  ${issue.fix}`] : [])];
}

function formatCodexPluginStatus(report: DoctorReport): string {
  const installed = PRODUCTS.filter((product) => report.codexPlugins[product.id]);
  const enabled = installed.filter((product) => report.codexPlugins[product.id]?.enabled);
  const current = enabled.filter((product) => versionsMatch(report.codexPlugins[product.id]?.version, report.githubVersions[product.id]));
  if (installed.length === PRODUCTS.length && current.length === PRODUCTS.length) return 'Codex plugins: 3 / 3 enabled and match GitHub main.';
  return `Codex plugins: ${enabled.length} / ${PRODUCTS.length} enabled; ${current.length} match GitHub main.`;
}

function formatCodexSkillStatus(report: DoctorReport): string {
  const caches = Object.values(report.codexSkills);
  if (!caches.length) return 'Codex skill cache: not detected; skipped.';
  const expected = caches.reduce((total, cache) => total + cache.expected, 0);
  const cached = caches.reduce((total, cache) => total + cache.cached, 0);
  const valid = caches.every((cache) => !cache.missing.length && !cache.invalid.length);
  if (valid) return `Codex skills: ${cached} / ${expected} cached and valid.`;
  return `Codex skills: ${cached} / ${expected} cached and valid; refresh needed.`;
}

function formatCodexMcpStatus(report: DoctorReport): string {
  const configured = PRODUCTS.filter((product) => report.codexMcp[product.id]);
  const healthy = configured.filter((product) => {
    const mcp = report.codexMcp[product.id];
    return mcp?.enabled && mcp.expectedCommand;
  });
  if (healthy.length === PRODUCTS.length) return 'Codex MCP: 3 / 3 enabled and target @latest.';
  return `Codex MCP: ${healthy.length} / ${PRODUCTS.length} enabled and target @latest.`;
}

function formatClaudePluginStatus(report: DoctorReport, updatesNeeded: number): string {
  const installed = PRODUCTS.filter((product) => report.claudePlugins[product.id]);
  if (!installed.length) return 'Claude plugins: not detected on this machine.';
  if (!updatesNeeded && installed.length === PRODUCTS.length) return 'Claude plugins: 3 / 3 match GitHub main.';
  return `Claude plugins: ${installed.length} installed; ${updatesNeeded} update${updatesNeeded === 1 ? '' : 's'} needed.`;
}

function productFromTitle(title: string): ProductId | null {
  const match = title.match(/(?:Codex|Claude) (?:plugin|skill cache) ([a-z-]+) (?:is behind|is incomplete|version mismatch|is missing)/u);
  return PRODUCTS.some((product) => product.id === match?.[1]) ? match?.[1] as ProductId : null;
}

function displayName(id: ProductId): string {
  return id === 'agent-memory' ? 'Agent Memory' : id === 'workflow' ? 'Workflow' : 'MR Review';
}

function versionsMatch(installed?: string, github?: string): boolean {
  return Boolean(installed && github && compareVersions(installed, github) === 0);
}

async function readGithubVersions(fetcher: typeof globalThis.fetch, issues: DoctorIssue[]): Promise<Partial<Record<ProductId, string>>> {
  const results = await Promise.all(PRODUCTS.map(async (product) => {
    try {
      const response = await fetcher(`${GITHUB_RAW_ROOT}/plugins/${product.id}/.codex-plugin/plugin.json`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const payload = await response.json() as { version?: unknown };
      if (typeof payload.version !== 'string' || !payload.version.trim()) throw new Error('manifest has no version');
      return [product.id, payload.version] as const;
    } catch {
      issues.push({
        severity: 'warning',
        title: `Could not check GitHub version for ${product.id}`,
        detail: 'Network access or the GitHub manifest was unavailable; local checks still completed.',
      });
      return null;
    }
  }));
  return Object.fromEntries(results.filter((value): value is readonly [ProductId, string] => value !== null));
}

function readCodexPlugins(runCommand: (command: string, args: string[]) => CommandResult, issues: DoctorIssue[]): DoctorReport['codexPlugins'] {
  const result = runCommand('codex', ['plugin', 'list', '--marketplace', MARKETPLACE, '--json']);
  if (!result.ok) {
    issues.push({ severity: 'warning', title: 'Could not inspect Codex plugins', detail: 'The Codex CLI was unavailable or did not return its plugin inventory.' });
    return {};
  }
  const payload = parseJson<CodexPluginList>(result.stdout);
  if (!payload) {
    issues.push({ severity: 'warning', title: 'Could not parse Codex plugin inventory', detail: 'The Codex CLI returned an unexpected response.' });
    return {};
  }
  const installed: DoctorReport['codexPlugins'] = {};
  for (const product of PRODUCTS) {
    const plugin = payload.installed?.find((candidate) => candidate.name === product.id && candidate.marketplaceName === MARKETPLACE);
    if (plugin && typeof plugin.version === 'string') installed[product.id] = { version: plugin.version, enabled: plugin.enabled !== false };
  }
  return installed;
}

function readCodexSkillCaches(
  homeDirectory: string,
  plugins: DoctorReport['codexPlugins'],
  issues: DoctorIssue[],
  notes: string[],
): DoctorReport['codexSkills'] {
  const cacheRoot = join(homeDirectory, '.codex', 'plugins', 'cache', MARKETPLACE);
  if (!existsSync(cacheRoot)) {
    notes.push('Codex skill cache was not found; skipped.');
    return {};
  }

  const caches: DoctorReport['codexSkills'] = {};
  for (const product of PRODUCTS) {
    const plugin = plugins[product.id];
    if (!plugin) continue;
    const cacheDirectory = join(cacheRoot, product.id, plugin.version);
    const manifestPath = join(cacheDirectory, '.codex-plugin', 'plugin.json');
    const expected = product.skills.length;
    if (!existsSync(cacheDirectory) || !existsSync(manifestPath)) {
      caches[product.id] = { expected, cached: 0, missing: [...product.skills], invalid: [] };
      issues.push({
        severity: 'error',
        title: `Codex skill cache ${product.id} is missing`,
        detail: `Codex reports plugin ${plugin.version}, but its cached bundle is unavailable.`,
        fix: refreshPluginCommand(product),
      });
      continue;
    }

    const manifest = parseJson<CachedPluginManifest>(readFileSync(manifestPath, 'utf8'));
    if (manifest?.version !== plugin.version) {
      caches[product.id] = { expected, cached: 0, missing: [...product.skills], invalid: [] };
      issues.push({
        severity: 'error',
        title: `Codex skill cache ${product.id} version mismatch`,
        detail: `Codex reports ${plugin.version}, but the cached plugin manifest reports ${typeof manifest?.version === 'string' ? manifest.version : 'no version'}.`,
        fix: refreshPluginCommand(product),
      });
      continue;
    }

    const missing: string[] = [];
    const invalid: string[] = [];
    for (const skill of product.skills) {
      const skillPath = join(cacheDirectory, 'skills', skill, 'SKILL.md');
      if (!existsSync(skillPath)) {
        missing.push(skill);
        continue;
      }
      const contents = readFileSync(skillPath, 'utf8');
      if (!new RegExp(`^name: ${skill}$`, 'm').test(contents)) invalid.push(skill);
    }
    const cached = expected - missing.length - invalid.length;
    caches[product.id] = { expected, cached, missing, invalid };
    if (missing.length || invalid.length) {
      issues.push({
        severity: 'error',
        title: `Codex skill cache ${product.id} is incomplete`,
        detail: `Cached ${cached} of ${expected} expected skills.`,
        fix: refreshPluginCommand(product),
      });
    }
  }
  return caches;
}

function readCodexMcp(runCommand: (command: string, args: string[]) => CommandResult, issues: DoctorIssue[]): DoctorReport['codexMcp'] {
  const found: DoctorReport['codexMcp'] = {};
  let checked = false;
  for (const product of PRODUCTS) {
    const result = runCommand('codex', ['mcp', 'get', product.id, '--json']);
    if (!result.ok) continue;
    checked = true;
    const payload = parseJson<CodexMcpConfig>(result.stdout);
    if (!payload) continue;
    const expectedCommand = payload.transport?.type === 'stdio'
      && payload.transport.command === 'npx'
      && payload.transport.args?.join('\u0000') === ['-y', `${product.packageName}@latest`].join('\u0000');
    found[product.id] = { enabled: payload.enabled !== false, expectedCommand };
  }
  if (!checked) {
    issues.push({ severity: 'warning', title: 'Could not inspect Codex MCP configuration', detail: 'The Codex CLI was unavailable or none of the Wiolett MCP servers are configured.' });
  }
  return found;
}

function readClaudePlugins(homeDirectory: string, notes: string[]): DoctorReport['claudePlugins'] {
  const installedPath = join(homeDirectory, '.claude', 'plugins', 'installed_plugins.json');
  if (!existsSync(installedPath)) {
    notes.push('Claude plugin registry was not found; skipped.');
    return {};
  }
  try {
    const payload = JSON.parse(readFileSync(installedPath, 'utf8')) as ClaudeInstalledPlugins;
    const found: DoctorReport['claudePlugins'] = {};
    for (const product of PRODUCTS) {
      const record = payload.plugins?.[`${product.id}@${MARKETPLACE}`]?.[0];
      if (record?.version) found[product.id] = { version: record.version, scope: record.scope };
    }
    return found;
  } catch {
    notes.push('Claude plugin registry could not be read; skipped.');
    return {};
  }
}

function runLocalCommand(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  return { ok: result.status === 0 && !result.error, stdout: result.stdout ?? '' };
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function replacementMcpCommand(product: Product): string {
  return `codex mcp remove ${product.id} && codex mcp add ${product.id} -- npx -y ${product.packageName}@latest`;
}

function refreshPluginCommand(product: Product): string {
  return `codex plugin marketplace upgrade ${MARKETPLACE} && codex plugin remove ${product.id}@${MARKETPLACE} && codex plugin add ${product.id}@${MARKETPLACE}`;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(/[.+-]/u).map(Number);
  const rightParts = right.split(/[.+-]/u).map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
}
