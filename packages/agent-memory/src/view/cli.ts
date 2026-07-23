import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { detectMemoryState } from '../runtime.js';
import { getMemoryRoot } from '../scope.js';
import type { MemoryScope } from '../scope.js';
import { startViewServer } from './server.js';

interface ViewArgs {
  scope: MemoryScope;
  port?: number;
  open: boolean;
}

function parseArgs(args: string[]): ViewArgs {
  let scope: MemoryScope = 'project';
  let port: number | undefined;
  let open = true;
  let target: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--no-open') {
      open = false;
    } else if (arg === '--port') {
      port = Number(args[i + 1]);
      i += 1;
    } else if (arg.startsWith('--port=')) {
      port = Number(arg.slice('--port='.length));
    } else if (arg === 'global') {
      scope = 'global';
    } else if (!arg.startsWith('-')) {
      target = arg;
    }
  }

  if (scope === 'project' && target) {
    const resolved = path.resolve(target);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      throw new Error(`Project path does not exist or is not a directory: ${resolved}`);
    }
    // Read-time path resolution is cwd-based, so retarget the process (matches the
    // test harness `withProject`). Done before any memory module reads state.
    process.chdir(resolved);
  }

  if (port !== undefined && (!Number.isFinite(port) || port <= 0 || port > 65535)) {
    throw new Error(`Invalid --port value: ${port}`);
  }

  return { scope, port, open };
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // Opening a browser is best-effort; never fail the command over it.
  }
}

function printViewHelp(): void {
  console.log([
    'Usage: agent-memory view [path|global] [options]',
    '',
    '  path      Project directory whose .memory store to open (default: cwd)',
    '  global    Open the configured global store',
    '',
    'Options:',
    '  --port <n>   Preferred port (default 7077; auto-increments if taken)',
    '  --no-open    Do not launch the browser automatically',
  ].join('\n'));
}

export async function runViewCommand(args: string[], version: string): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printViewHelp();
    return;
  }

  const { scope, port, open } = parseArgs(args);

  const state = detectMemoryState(scope);
  const label = scope === 'global' ? 'global' : getMemoryRoot('project');
  if (!state.enabled) {
    console.error(`! No memory store found for scope "${scope}" (${label}).`);
    console.error('  The dashboard will open in an empty state. Create memories first, or pass a project path.');
  }

  const handle = await startViewServer({ scope, port, version });

  console.log('');
  console.log(`  Agent Memory View — ${scope} scope`);
  console.log(`  ${scope === 'global' ? getMemoryRoot('global') : getMemoryRoot('project')}`);
  console.log(`  ${handle.url}`);
  console.log('');
  console.log('  Press Ctrl+C to stop.');

  if (open) openBrowser(handle.url);

  const shutdown = (): void => {
    void handle.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
