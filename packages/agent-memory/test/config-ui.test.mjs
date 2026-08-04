import { expect, test } from '@jest/globals';
import { formatGuidedMessage } from '../dist/cli/config-ui.js';

test('formats ordinary CLI text without a box or title while preserving a guide on wrapped lines', () => {
  const originalColumns = process.stdout.columns;
  Object.defineProperty(process.stdout, 'columns', { value: 36, configurable: true });
  try {
    const output = formatGuidedMessage('Existing OpenAI settings from /a/very/long/configuration/path/ai-providers.yml will be used as defaults.');
    const lines = output.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^◇  /u);
    expect(lines.slice(1)).toEqual(expect.arrayContaining([expect.stringMatching(/^│  /u)]));
    expect(output).not.toContain('┌');
  } finally {
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, configurable: true });
  }
});
