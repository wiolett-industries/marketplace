import { describe, expect, test } from '@jest/globals';
import { runHarness } from './run-harness.mjs';

describe('superseded derank in retrieval (B1)', () => {
  const result = runHarness('derank');
  const { a, b, d } = result.ids;

  test('search flags superseded memories and penalizes their score', () => {
    const aResult = result.search.find((entry) => entry.id === a);
    const bResult = result.search.find((entry) => entry.id === b);
    expect(aResult.superseded).toBe(false);
    expect(bResult.superseded).toBe(true);
    expect(aResult.score).toBeGreaterThan(bResult.score);
  });

  test('superseded memory is not hidden, just ranked below fresh ones', () => {
    const ids = result.search.map((entry) => entry.id);
    expect(ids).toContain(b); // still present
    expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b)); // ranked after a
  });

  test('recall down-ranks the superseded neighbor below the fresh one', () => {
    expect(result.recallRelatedIds).toContain(d);
    expect(result.recallRelatedIds).toContain(b);
    expect(result.recallRelatedIds.indexOf(d)).toBeLessThan(result.recallRelatedIds.indexOf(b));
  });
});
