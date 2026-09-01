import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface ProjectMemoryGitignoreResult {
  gitignorePath: string | null;
  updated: boolean;
}

export function updateProjectMemoryGitignore(
  projectPath: string,
  memoryDir: string,
): ProjectMemoryGitignoreResult {
  const relativeMemoryDir = projectRelativePath(projectPath, memoryDir);
  if (relativeMemoryDir === null) return { gitignorePath: null, updated: false };

  const gitignorePath = path.join(projectPath, '.gitignore');
  const exists = existsSync(gitignorePath);
  const source = exists ? readFileSync(gitignorePath, 'utf8') : '';
  const dbIgnoreEntry = relativeMemoryDir
    ? `${relativeMemoryDir}/memory.db*`
    : 'memory.db*';
  const broadIgnoreEntries = broadIgnorePatterns(relativeMemoryDir);
  let lines = source ? source.replaceAll('\r\n', '\n').split('\n') : [];
  lines = lines.filter((line) => !broadIgnoreEntries.has(line.trim()));
  if (lines.every((line) => line === '')) lines = [];

  if (!lines.some((line) => line.trim() === dbIgnoreEntry)) {
    if (lines.length && lines.at(-1) !== '') lines.push('');
    lines.push(dbIgnoreEntry, '');
  }

  const next = lines.join('\n');
  if (exists && next === source.replaceAll('\r\n', '\n')) {
    return { gitignorePath, updated: false };
  }

  writeFileSync(gitignorePath, next, 'utf8');
  return { gitignorePath, updated: true };
}

function projectRelativePath(projectPath: string, memoryDir: string): string | null {
  const relative = path.relative(path.resolve(projectPath), path.resolve(memoryDir));
  if (relative === '') return '';
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}

function broadIgnorePatterns(relativeMemoryDir: string): Set<string> {
  if (!relativeMemoryDir) return new Set();
  return new Set([
    relativeMemoryDir,
    `${relativeMemoryDir}/`,
    `/${relativeMemoryDir}`,
    `/${relativeMemoryDir}/`,
    `${relativeMemoryDir}/**`,
    `/${relativeMemoryDir}/**`,
  ]);
}
