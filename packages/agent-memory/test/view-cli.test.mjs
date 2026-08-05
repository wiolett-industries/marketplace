import { expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

test('formats the interactive View launch without server noise', () => {
  expect(runHarness('view-cli').output).toBe(
    'Memory view started: http://127.0.0.1:7077\nPress Ctrl+C to stop.',
  );
  expect(runHarness('view-cli').outro).toBe(
    'Memory view started\nhttp://127.0.0.1:7077\n\nPress Ctrl+C to stop.',
  );
});
