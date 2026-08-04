import { runInitCommand, needsInteractiveInitialization } from './init.js';
import { runConsolidateCommand, getEligibleConsolidationScopes } from './consolidate-command.js';
import { runConfigCommand } from './config-command.js';
import { createConfigCliUi } from './config-ui.js';
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
    if (action === 'usage') runUsageCommand({ ui });
    if (action === 'doctor') await runDoctorCommand({ ui });
  }
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
