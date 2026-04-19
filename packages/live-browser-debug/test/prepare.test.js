import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectInjectionPlan } from '../src/prepare.js';

function makeRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'live-browser-debug-prepare-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents);
  }
  return root;
}

test('detectInjectionPlan prefers vite shim when vite config exists', () => {
  const repoRoot = makeRepo({
    'package.json': JSON.stringify({ name: 'app' }),
    'vite.config.ts': 'export default {};',
    'src/main.tsx': 'console.log("hi");',
  });

  const plan = detectInjectionPlan(repoRoot, 'ws://127.0.0.1:46777/ws');
  assert.equal(plan.method, 'dev_server_shim');
  assert.equal(plan.framework, 'vite');
  assert.deepEqual(plan.target_files, ['vite.config.ts']);
  assert.match(plan.patch, /WebSocket/);
});

test('detectInjectionPlan falls back to react entry patch', () => {
  const repoRoot = makeRepo({
    'package.json': JSON.stringify({ name: 'app' }),
    'src/main.tsx': 'console.log("hi");',
  });

  const plan = detectInjectionPlan(repoRoot, 'ws://127.0.0.1:46777/ws');
  assert.equal(plan.method, 'source_patch');
  assert.equal(plan.framework, 'react-entry');
  assert.deepEqual(plan.target_files, ['src/main.tsx']);
  assert.match(plan.patch, /WIOLETT_LIVE_BROWSER_DEBUG/);
});

test('detectInjectionPlan falls back to next layout patch', () => {
  const repoRoot = makeRepo({
    'package.json': JSON.stringify({ name: 'app', dependencies: { next: '^15.0.0' } }),
    'app/layout.tsx': 'export default function Layout({ children }) { return children; }',
  });

  const plan = detectInjectionPlan(repoRoot, 'ws://127.0.0.1:46777/ws');
  assert.equal(plan.method, 'source_patch');
  assert.equal(plan.framework, 'next-layout');
  assert.deepEqual(plan.target_files, ['app/layout.tsx']);
  assert.match(plan.patch, /WebSocket/);
});

test('detectInjectionPlan falls back to html shell patch', () => {
  const repoRoot = makeRepo({
    'package.json': JSON.stringify({ name: 'app' }),
    'index.html': '<!doctype html><html><head></head><body></body></html>',
  });

  const plan = detectInjectionPlan(repoRoot, 'ws://127.0.0.1:46777/ws');
  assert.equal(plan.method, 'source_patch');
  assert.equal(plan.framework, 'html-shell');
  assert.deepEqual(plan.target_files, ['index.html']);
  assert.match(plan.patch, /<script>/);
});
