import { describe, it, expect } from 'vitest';
import { matchWhenClause } from '../handlers/ts/framework/engine.js';
import type { WhenPattern, ActionCompletion } from '../runtime/types.js';

describe('Sync Engine Matcher Performance (Regression)', () => {
  it('handles exponential completion sets via backtracking', () => {
    // 3 patterns of same type
    const patterns: WhenPattern[] = [
      { concept: 'C', action: 'A', inputFields: [], outputFields: [] },
      { concept: 'C', action: 'A', inputFields: [], outputFields: [] },
      { concept: 'C', action: 'A', inputFields: [], outputFields: [] },
    ];

    // 100 completions of that type
    const completions: ActionCompletion[] = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      concept: 'C',
      action: 'A',
      input: {},
      output: {},
      flow: 'f1',
      timestamp: new Date().toISOString(),
    }));

    const trigger = completions[0];

    // Old crossProduct would be 100 * 100 * 100 = 1,000,000 combinations
    // before filtering for trigger and consistency.
    // Backtracking should handle this instantly since there are no variables.
    const start = Date.now();
    const results = matchWhenClause(patterns, completions, trigger);
    const end = Date.now();

    expect(end - start).toBeLessThan(1000); // Should be very fast
    expect(results.length).toBeGreaterThan(0);
  });

  it('correctly binds variables across patterns', () => {
    const patterns: WhenPattern[] = [
      {
        concept: 'User', action: 'Create',
        inputFields: [{ name: 'id', match: { type: 'variable', name: 'uid' } }],
        outputFields: []
      },
      {
        concept: 'Profile', action: 'Update',
        inputFields: [{ name: 'userId', match: { type: 'variable', name: 'uid' } }],
        outputFields: []
      }
    ];

    const completions: ActionCompletion[] = [
      { id: 'u1', concept: 'User', action: 'Create', input: { id: 'user_1' }, flow: 'f1', timestamp: '' },
      { id: 'u2', concept: 'User', action: 'Create', input: { id: 'user_2' }, flow: 'f1', timestamp: '' },
      { id: 'p1', concept: 'Profile', action: 'Update', input: { userId: 'user_1' }, flow: 'f1', timestamp: '' },
      { id: 'p2', concept: 'Profile', action: 'Update', input: { userId: 'user_3' }, flow: 'f1', timestamp: '' },
    ];

    const trigger = completions[0]; // u1
    const results = matchWhenClause(patterns, completions, trigger);

    expect(results).toHaveLength(1);
    expect(results[0].uid).toBe('user_1');
    expect(results[0].__matchedCompletionIds).toContain('u1');
    expect(results[0].__matchedCompletionIds).toContain('p1');
  });
});
