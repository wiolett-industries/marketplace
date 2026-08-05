import { spawn } from 'node:child_process';
import { runInitCommand, needsInteractiveInitialization } from './init.js';
import { runConsolidateCommand, getEligibleConsolidationScopes } from './consolidate-command.js';
import { runConfigCommand } from './config-command.js';
import { createConfigCliUi, type ConfigCliUi } from './config-ui.js';
import { runDoctorCommand } from './doctor-command.js';
import { runUsageCommand } from './usage-command.js';

export async function runInteractiveRootCommand(): Promise<void> {
  if (needsInteractiveInitialization()) {
    await runInitCommand([], { commandName: 'agent-memory' });
    return;
  }

  const ui = createConfigCliUi();
  ui.intro('Agent Memory');
  let consolidationAvailable = await refreshConsolidationAvailability(ui);

  while (true) {
    const action = await ui.select('What do you want to do?', [
      { value: 'config', label: 'Configure Agent Memory', hint: 'Providers, model routes, and storage paths' },
      ...(consolidationAvailable ? [{ value: 'consolidate', label: 'Consolidate memory', hint: 'Review stale project or global memory with Codex' }] : []),
      { value: 'view', label: 'Open memory view', hint: 'Launch the local read-only dashboard for this project' },
      { value: 'usage', label: 'View model usage', hint: 'Tokens and provider-reported cost over the last 30 days' },
      { value: 'doctor', label: 'Run Doctor', hint: 'Compare GitHub releases with local plugins and MCP targets' },
      { value: 'exit', label: 'Exit' },
    ]);
    if (!action || action === 'exit') {
      ui.outro('Agent Memory complete.');
      return;
    }
    if (action === 'config') {
      await runConfigCommand([], { ui, showIntro: false, showOutro: false });
      consolidationAvailable = await refreshConsolidationAvailability(ui);
    }
    if (action === 'consolidate') {
      await runConsolidateCommand({ ui });
      consolidationAvailable = await refreshConsolidationAvailability(ui);
    }
    if (action === 'view') {
      await launchQuietView(ui);
      return;
    }
    if (action === 'usage') runUsageCommand({ ui });
    if (action === 'doctor') await runDoctorCommand({ ui });
  }
}

export function formatInteractiveViewOutro(url: string): string {
  return `Memory view started\n${url}\n\nPress Ctrl+C to stop.`;
}

/**
 * The dashboard itself is quiet, but opening its first API endpoint can rebuild
 * a stale graph and emit useful diagnostic stderr. Keep those diagnostics for
 * the direct `view` command while the interactive shortcut remains uncluttered.
 */
async function launchQuietView(ui: Pick<ConfigCliUi, 'outro'>): Promise<void> {
  const child = spawn(process.execPath, ['--no-warnings', process.argv[1]], {
    cwd: process.cwd(),
    env: { ...process.env, AGENT_MEMORY_INTERACTIVE_VIEW: '1' },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  let startupOutput = '';
  let announced = false;
  child.stdout?.on('data', (chunk: Buffer) => {
    startupOutput += chunk.toString();
    const match = startupOutput.match(/^Memory view started: (https?:\/\/[^\s]+)$/mu);
    if (!match || announced) return;
    announced = true;
    ui.outro(formatInteractiveViewOutro(match[1]));
  });

  let pendingStderr = '';
  const forwardStderrLine = (line: string): void => {
    if (!line.startsWith('[agent-memory]')) process.stderr.write(line);
  };
  child.stderr?.on('data', (chunk: Buffer) => {
    pendingStderr += chunk.toString();
    const lines = pendingStderr.split(/(?<=\n)/);
    pendingStderr = lines.pop() ?? '';
    for (const line of lines) forwardStderrLine(line);
  });
  child.stderr?.on('end', () => {
    if (pendingStderr) forwardStderrLine(pendingStderr);
  });

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code && code !== 0) {
        reject(new Error(`Memory view exited with code ${code}.`));
        return;
      }
      if (signal && signal !== 'SIGINT' && signal !== 'SIGTERM') {
        reject(new Error(`Memory view stopped by ${signal}.`));
        return;
      }
      resolve();
    });
  });
}

async function refreshConsolidationAvailability(ui: ReturnType<typeof createConfigCliUi>): Promise<boolean> {
  const spinner = ui.spinner('Checking consolidation availability...');
  try {
    const scopes = await getEligibleConsolidationScopes();
    spinner.stop(scopes.length ? 'Consolidation is available' : 'Consolidation is unavailable');
    return scopes.length > 0;
  } catch {
    spinner.stop('Consolidation is unavailable');
    return false;
  }
}
