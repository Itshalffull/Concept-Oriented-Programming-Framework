/**
 * Tests for ?concept/?action wildcard matching in when-clauses.
 * Verifies that the sync engine can match completions from dynamically-
 * dispatched concepts (where the concept/action aren't known at sync
 * definition time).
 */

import { describe, it, expect } from 'vitest';
import { matchWhenClause } from '../handlers/ts/framework/engine.js';
import type { WhenPattern, ActionCompletion } from '../runtime/types.js';

function makeCompletion(
  concept: string,
  action: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  flow = 'flow-1',
  id?: string,
): ActionCompletion {
  return {
    id: id ?? `${concept}/${action}-${Math.random().toString(36).slice(2, 8)}`,
    concept,
    action,
    input,
    output,
    variant: (output.variant as string) ?? 'ok',
    flow,
    timestamp: Date.now(),
  };
}

describe('Wildcard ?concept/?action in when-clause', () => {
  it('matches a static concept with wildcard ?action', () => {
    const patterns: WhenPattern[] = [
      {
        concept: 'urn:clef/KernelViewResolver',
        action: '?action',
        inputFields: [],
        outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
      },
    ];

    const trigger = makeCompletion(
      'urn:clef/KernelViewResolver',
      'resolve',
      {},
      { variant: 'ok', data: '[]' },
    );

    const bindings = matchWhenClause(patterns, [trigger], trigger);
    expect(bindings.length).toBe(1);
    expect(bindings[0].action).toBe('resolve');
  });

  it('matches wildcard ?concept with static action', () => {
    const patterns: WhenPattern[] = [
      {
        concept: '?concept',
        action: 'list',
        inputFields: [],
        outputFields: [
          { name: 'variant', match: { type: 'literal', value: 'ok' } },
          { name: 'items', match: { type: 'variable', name: 'data' } },
        ],
      },
    ];

    const trigger = makeCompletion(
      'urn:clef/ContentNode',
      'list',
      {},
      { variant: 'ok', items: '[{"node":"n1"}]' },
    );

    const bindings = matchWhenClause(patterns, [trigger], trigger);
    expect(bindings.length).toBe(1);
    expect(bindings[0].concept).toBe('urn:clef/ContentNode');
    expect(bindings[0].data).toBe('[{"node":"n1"}]');
  });

  it('matches wildcard ?concept/?action (both dynamic)', () => {
    const patterns: WhenPattern[] = [
      {
        concept: '?concept',
        action: '?action',
        inputFields: [],
        outputFields: [
          { name: 'variant', match: { type: 'literal', value: 'ok' } },
          { name: 'items', match: { type: 'variable', name: 'data' } },
        ],
      },
    ];

    const trigger = makeCompletion(
      'urn:clef/ContentNode',
      'list',
      {},
      { variant: 'ok', items: '[{"node":"n1"}]' },
    );

    const bindings = matchWhenClause(patterns, [trigger], trigger);
    expect(bindings.length).toBe(1);
    expect(bindings[0].concept).toBe('urn:clef/ContentNode');
    expect(bindings[0].action).toBe('list');
    expect(bindings[0].data).toBe('[{"node":"n1"}]');
  });

  it('matches multi-pattern with one static and one wildcard', () => {
    // This is the ViewResolveTracksItems pattern:
    // KernelViewResolver/resolve => ok + ?concept/?action => ok with items
    const patterns: WhenPattern[] = [
      {
        concept: 'urn:clef/KernelViewResolver',
        action: 'resolve',
        inputFields: [{ name: 'view', match: { type: 'variable', name: 'view' } }],
        outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
      },
      {
        concept: '?concept',
        action: '?action',
        inputFields: [],
        outputFields: [
          { name: 'variant', match: { type: 'literal', value: 'ok' } },
          { name: 'items', match: { type: 'variable', name: 'data' } },
        ],
      },
    ];

    const resolverCompletion = makeCompletion(
      'urn:clef/KernelViewResolver',
      'resolve',
      { view: 'content-list' },
      { variant: 'ok', target_concept: 'urn:clef/ContentNode', target_action: 'list' },
      'flow-1',
      'c1',
    );

    const dataCompletion = makeCompletion(
      'urn:clef/ContentNode',
      'list',
      {},
      { variant: 'ok', items: '[{"node":"n1"},{"node":"n2"}]' },
      'flow-1',
      'c2',
    );

    // Trigger is the data completion (second pattern fires when data arrives)
    const bindings = matchWhenClause(
      patterns,
      [resolverCompletion, dataCompletion],
      dataCompletion,
    );

    expect(bindings.length).toBe(1);
    expect(bindings[0].view).toBe('content-list');
    expect(bindings[0].concept).toBe('urn:clef/ContentNode');
    expect(bindings[0].action).toBe('list');
    expect(bindings[0].data).toBe('[{"node":"n1"},{"node":"n2"}]');
  });

  it('wildcard does not match the same completion used by another pattern', () => {
    // Ensure the resolver completion isn't reused for the wildcard pattern
    const patterns: WhenPattern[] = [
      {
        concept: 'urn:clef/KernelViewResolver',
        action: 'resolve',
        inputFields: [],
        outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
      },
      {
        concept: '?concept',
        action: '?action',
        inputFields: [],
        outputFields: [
          { name: 'variant', match: { type: 'literal', value: 'ok' } },
          { name: 'items', match: { type: 'variable', name: 'data' } },
        ],
      },
    ];

    // Only one completion — the resolver. No data completion available.
    const resolverCompletion = makeCompletion(
      'urn:clef/KernelViewResolver',
      'resolve',
      {},
      { variant: 'ok' },
      'flow-1',
      'c1',
    );

    // Trigger on resolver — wildcard pattern has no candidates
    const bindings = matchWhenClause(patterns, [resolverCompletion], resolverCompletion);
    expect(bindings.length).toBe(0);
  });

  it('consistent binding: wildcard variable must match across patterns', () => {
    // Two wildcard patterns that must bind ?concept to the same value
    const patterns: WhenPattern[] = [
      {
        concept: '?concept',
        action: 'prepare',
        inputFields: [],
        outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
      },
      {
        concept: '?concept',
        action: 'execute',
        inputFields: [],
        outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
      },
    ];

    const c1 = makeCompletion('urn:clef/A', 'prepare', {}, { variant: 'ok' }, 'f1', 'c1');
    const c2 = makeCompletion('urn:clef/A', 'execute', {}, { variant: 'ok' }, 'f1', 'c2');
    const c3 = makeCompletion('urn:clef/B', 'execute', {}, { variant: 'ok' }, 'f1', 'c3');

    // Should match: A/prepare + A/execute (same ?concept binding)
    const bindings = matchWhenClause(patterns, [c1, c2, c3], c1);
    expect(bindings.length).toBe(1);
    expect(bindings[0].concept).toBe('urn:clef/A');
  });
});
