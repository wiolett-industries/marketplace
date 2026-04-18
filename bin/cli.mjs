#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const DEFAULT_SOURCE = 'wiolett-industries/marketplace';

function printHelp() {
  process.stdout.write(
    [
      'Usage:',
      '  npx @wiolett/marketplace',
      '  npx @wiolett/marketplace install [--ref <ref>] [--source <source>] [--verbose] [--yes]',
      '',
      'Commands:',
      '  install   Register the Wiolett marketplace in Codex via `codex marketplace add`.',
      '  help      Show this help message.',
      '',
      'Options:',
      '  --ref <ref>       Git ref to pass through to `codex marketplace add --ref`.',
      '  --source <value>  Marketplace source. Defaults to wiolett-industries/marketplace.',
      '  --verbose         Print the exact Codex command before running it.',
      '  --yes             Skip the confirmation prompt.',
      '',
      'Bare invocation defaults to `install`.',
      '',
    ].join('\n')
  );
}

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = 'install';

  if (args.length > 0 && !args[0].startsWith('-')) {
    command = args.shift() ?? 'install';
  }

  let ref = null;
  let source = DEFAULT_SOURCE;
  let verbose = false;
  let yes = false;

  while (args.length > 0) {
    const token = args.shift();

    if (token === '--ref') {
      ref = args.shift() ?? fail('Missing value for --ref.');
      continue;
    }

    if (token === '--source') {
      source = args.shift() ?? fail('Missing value for --source.');
      continue;
    }

    if (token === '--verbose') {
      verbose = true;
      continue;
    }

    if (token === '--yes' || token === '-y') {
      yes = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      command = 'help';
      continue;
    }

    fail(`Unknown argument: ${token}`);
  }

  return { command, ref, source, verbose, yes };
}

function ensureCodexExists() {
  const result = spawnSync('codex', ['--help'], { stdio: 'ignore' });
  if (result.error && result.error.code === 'ENOENT') {
    fail('Codex CLI was not found in PATH. Install Codex first, then re-run this command.');
  }
}

async function confirmInstall(args) {
  if (args.yes) {
    return true;
  }

  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) {
    fail('Refusing to install without confirmation in a non-interactive shell. Re-run with --yes to proceed.');
  }

  const commandPreview = ['codex', 'marketplace', 'add', args.source];
  if (args.ref) {
    commandPreview.push('--ref', args.ref);
  }

  process.stdout.write(`This will run: ${commandPreview.join(' ')}\n`);
  const rl = readline.createInterface({ input, output });

  try {
    const answer = (await rl.question('Proceed? [y/N] ')).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

async function runInstall({ source, ref, verbose, yes }) {
  ensureCodexExists();

  const confirmed = await confirmInstall({ source, ref, yes });
  if (!confirmed) {
    process.stdout.write('Cancelled.\n');
    process.exit(0);
  }

  const args = ['marketplace', 'add', source];
  if (ref) {
    args.push('--ref', ref);
  }

  if (verbose) {
    process.stdout.write(`Running: codex ${args.join(' ')}\n`);
  }

  const result = spawnSync('codex', args, {
    stdio: 'inherit',
  });

  if (result.error) {
    fail(`Failed to run Codex CLI: ${result.error.message}`);
  }

  process.exit(result.status ?? 1);
}

const parsed = parseArgs(process.argv.slice(2));

if (parsed.command === 'help') {
  printHelp();
  process.exit(0);
}

if (parsed.command === 'install') {
  await runInstall(parsed);
  process.exit(0);
}

fail(`Unknown command: ${parsed.command}`);
