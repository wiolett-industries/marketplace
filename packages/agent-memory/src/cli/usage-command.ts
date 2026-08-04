import { formatUsageSummary, readUsageSummary } from '../usage.js';
import type { ConfigCliUi } from './config-ui.js';

export function runUsageCommand(input: { ui: ConfigCliUi; days?: number } ): void {
  const days = input.days ?? 30;
  input.ui.note(formatUsageSummary(readUsageSummary({ days }), { days }), 'Model usage');
}
