import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDocument } from 'yaml';
import * as z from 'zod/v4';

const configSchema = z.object({
  version: z.literal(1),
  mcp: z.object({
    'merge-request-review': z.object({
      artifacts: z.object({ root: z.string().min(1).optional() }).passthrough().optional(),
    }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

const warnedPaths = new Set<string>();

export function readReviewArtifactRoot(workspaceRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const configPath = getMcpConfigPath(env);
  const fallback = path.join(workspaceRoot, '.workflow', 'mr-reviews');
  if (!existsSync(configPath)) return fallback;
  try {
    const document = parseDocument(readFileSync(configPath, 'utf8'), { schema: 'core', uniqueKeys: true });
    if (document.errors.length) throw document.errors[0];
    const parsed = configSchema.parse(document.toJS());
    const configured = parsed.mcp['merge-request-review']?.artifacts?.root ?? '.workflow/mr-reviews';
    const expanded = configured === '~'
      ? os.homedir()
      : configured.startsWith('~/') ? path.join(os.homedir(), configured.slice(2)) : configured;
    return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(workspaceRoot, expanded));
  } catch (error) {
    warnOnce(configPath, error);
    return fallback;
  }
}

function getMcpConfigPath(env: NodeJS.ProcessEnv): string {
  const agentsHome = env.PROJECT_MEMORY_AGENTS_HOME?.trim()
    || env.AGENTS_HOME?.trim()
    || path.join(os.homedir(), '.agents');
  const configDir = env.WIOLETT_CONFIG_DIR?.trim() || path.join(agentsHome, '.wiolett', 'config');
  return path.join(configDir, 'mcp-config.yml');
}

function warnOnce(configPath: string, error: unknown): void {
  if (warnedPaths.has(configPath)) return;
  warnedPaths.add(configPath);
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[merge-request-review] invalid ${configPath}; using default artifact path: ${message}\n`);
}
