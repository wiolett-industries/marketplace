import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDocument } from 'yaml';
import * as z from 'zod/v4';

const configSchema = z.object({
  version: z.literal(1),
  mcp: z.object({
    workflow: z.object({
      artifacts: z.object({
        root: z.string().min(1).optional(),
        plans: z.string().min(1).optional(),
        audits: z.string().min(1).optional(),
      }).passthrough().optional(),
    }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

export interface WorkflowArtifactConfig {
  root: string;
  plans: string;
  audits: string;
}

const warnedPaths = new Set<string>();

export function readWorkflowArtifactConfig(workspaceRoot: string, env: NodeJS.ProcessEnv = process.env): WorkflowArtifactConfig {
  const defaults = { root: '.workflow', plans: 'plans', audits: 'audits' };
  const configPath = getMcpConfigPath(env);
  if (!existsSync(configPath)) return resolveConfig(defaults, workspaceRoot);
  try {
    const document = parseDocument(readFileSync(configPath, 'utf8'), { schema: 'core', uniqueKeys: true });
    if (document.errors.length) throw document.errors[0];
    const parsed = configSchema.parse(document.toJS());
    return resolveConfig({ ...defaults, ...parsed.mcp.workflow?.artifacts }, workspaceRoot);
  } catch (error) {
    warnOnce(configPath, error);
    return resolveConfig(defaults, workspaceRoot);
  }
}

function resolveConfig(config: { root: string; plans: string; audits: string }, workspaceRoot: string): WorkflowArtifactConfig {
  const root = resolveRoot(config.root, workspaceRoot);
  return {
    root,
    plans: resolveChild(root, config.plans, 'plans'),
    audits: resolveChild(root, config.audits, 'audits'),
  };
}

function getMcpConfigPath(env: NodeJS.ProcessEnv): string {
  const agentsHome = env.PROJECT_MEMORY_AGENTS_HOME?.trim()
    || env.AGENTS_HOME?.trim()
    || path.join(os.homedir(), '.agents');
  const configDir = env.WIOLETT_CONFIG_DIR?.trim() || path.join(agentsHome, '.wiolett', 'config');
  return path.join(configDir, 'mcp-config.yml');
}

function resolveRoot(value: string, workspaceRoot: string): string {
  const expanded = value === '~' ? os.homedir() : value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;
  return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(workspaceRoot, expanded));
}

function resolveChild(root: string, value: string, label: string): string {
  if (path.isAbsolute(value)) throw new Error(`Workflow ${label} path must be relative to the artifact root.`);
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Workflow ${label} path escapes the artifact root.`);
  return resolved;
}

function warnOnce(configPath: string, error: unknown): void {
  if (warnedPaths.has(configPath)) return;
  warnedPaths.add(configPath);
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[workflow] invalid ${configPath}; using default artifact paths: ${message}\n`);
}
