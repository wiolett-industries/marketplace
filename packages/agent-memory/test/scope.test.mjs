import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { getProjectRoot } from '../dist/scope.js';

const temporaryRoots = [];
const originalCwd = process.cwd();
const originalAgentsHome = process.env.PROJECT_MEMORY_AGENTS_HOME;

function temporaryRoot(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), `${prefix}-`));
  temporaryRoots.push(root);
  return root;
}

function configureDefaultMemoryPath() {
  process.env.PROJECT_MEMORY_AGENTS_HOME = temporaryRoot('pm-scope-agents-home');
}

function createGitBoundary(repository) {
  mkdirSync(path.join(repository, '.git'), { recursive: true });
  writeFileSync(path.join(repository, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8');
}

afterEach(() => {
  process.chdir(originalCwd);
  if (originalAgentsHome === undefined) delete process.env.PROJECT_MEMORY_AGENTS_HOME;
  else process.env.PROJECT_MEMORY_AGENTS_HOME = originalAgentsHome;
  while (temporaryRoots.length) rmSync(temporaryRoots.pop(), { recursive: true, force: true });
});

describe('project root discovery', () => {
  test('does not inherit memory through an invalid empty repository marker', () => {
    configureDefaultMemoryPath();
    const ancestor = temporaryRoot('pm-scope-non-repo');
    const child = path.join(ancestor, 'child');
    mkdirSync(path.join(ancestor, '.git'), { recursive: true });
    mkdirSync(path.join(ancestor, '.memory', 'memories'), { recursive: true });
    mkdirSync(child, { recursive: true });

    process.chdir(child);
    expect(getProjectRoot()).toBe(child);
  });

  test('discovers project memory from a child directory within the same repository', () => {
    configureDefaultMemoryPath();
    const repository = temporaryRoot('pm-scope-repository');
    const child = path.join(repository, 'packages', 'service');
    createGitBoundary(repository);
    mkdirSync(path.join(repository, '.memory', 'memories'), { recursive: true });
    mkdirSync(child, { recursive: true });

    process.chdir(child);
    expect(getProjectRoot()).toBe(repository);
  });

  test('stops at a nested repository boundary instead of leaking parent memory', () => {
    configureDefaultMemoryPath();
    const parentRepository = temporaryRoot('pm-scope-parent-repository');
    const nestedRepository = path.join(parentRepository, 'nested');
    const child = path.join(nestedRepository, 'src');
    createGitBoundary(parentRepository);
    mkdirSync(path.join(parentRepository, '.memory', 'memories'), { recursive: true });
    createGitBoundary(nestedRepository);
    mkdirSync(child, { recursive: true });

    process.chdir(child);
    expect(getProjectRoot()).toBe(nestedRepository);
  });
});
