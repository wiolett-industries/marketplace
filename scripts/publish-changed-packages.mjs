#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function readPackage(directory) {
  const manifestPath = path.join(directory, 'package.json');
  if (!existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.private || !manifest.name || !manifest.version) return null;

  return {
    directory,
    name: manifest.name,
    version: manifest.version,
    access: manifest.publishConfig?.access || 'public',
  };
}

function discoverPackages() {
  const packagesRoot = path.join(repositoryRoot, 'packages');
  const workspacePackages = readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readPackage(path.join(packagesRoot, entry.name)))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));

  const rootPackage = readPackage(repositoryRoot);
  return rootPackage ? [...workspacePackages, rootPackage] : workspacePackages;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repositoryRoot,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) throw result.error;
  return result;
}

function isPublished({ name, version }) {
  const result = run('npm', ['view', `${name}@${version}`, 'version', '--json'], { capture: true });
  if (result.status === 0) return true;

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (/\bE404\b|404 Not Found|is not in this registry/i.test(output)) return false;

  throw new Error(`Unable to check ${name}@${version} in npm registry:\n${output.trim()}`);
}

function publishPackage(packageInfo) {
  const result = run(
    'npm',
    ['publish', '--access', packageInfo.access, '--provenance'],
    { cwd: packageInfo.directory },
  );

  if (result.status !== 0) {
    throw new Error(`npm publish failed for ${packageInfo.name}@${packageInfo.version}`);
  }
}

function main() {
  const packages = discoverPackages();

  if (dryRun) {
    for (const packageInfo of packages) {
      console.log(`${packageInfo.name}@${packageInfo.version}`);
    }
    return;
  }

  if (!process.env.NODE_AUTH_TOKEN) {
    throw new Error('NODE_AUTH_TOKEN is required. Configure the GitHub Actions NPM_TOKEN secret.');
  }

  for (const packageInfo of packages) {
    const spec = `${packageInfo.name}@${packageInfo.version}`;
    if (isPublished(packageInfo)) {
      console.log(`Skipping ${spec}: already published.`);
      continue;
    }

    console.log(`Publishing ${spec}...`);
    publishPackage(packageInfo);
  }
}

main();
