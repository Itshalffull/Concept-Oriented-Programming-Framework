import { describe, it, expect } from 'vitest';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler';
import { readFileSync } from 'fs';
import { matchWhenClause, evaluateWhereClause, buildInvocations } from '../handlers/ts/framework/engine';
import type { ActionCompletion, CompiledSync, Binding } from '../runtime/types';

describe('View resolver sync chain', () => {
  it('parses the dispatch sync correctly', () => {
    const src = readFileSync('clef-base/suites/view-resolver/syncs/view-resolver-dispatches-to-provider.sync', 'utf-8');
    const syncs = parseSyncFile(src);
    expect(syncs).toHaveLength(1);
    const sync = syncs[0];
    expect(sync.name).toBe('ViewResolverDispatchesToProvider');
    // Check where clause has a query entry for PluginRegistry
    expect(sync.where).toHaveLength(1);
    expect(sync.where[0].type).toBe('query');
    expect(sync.where[0].concept).toBe('urn:clef/PluginRegistry');
    // Check bindings
    const bindings = sync.where[0].bindings || [];
    const fieldNames = bindings.map(b => b.field);
    expect(fieldNames).toContain('provider_id');
    expect(fieldNames).toContain('handler');
    console.log('Dispatch sync where clause:', JSON.stringify(sync.where, null, 2));
    console.log('Dispatch sync then clause:', JSON.stringify(sync.then, null, 2));
  });

  it('parses the kernel-resolver-fetches-data sync', () => {
    const src = readFileSync('clef-base/suites/view-resolver/syncs/kernel-resolver-fetches-data.sync', 'utf-8');
    const syncs = parseSyncFile(src);
    expect(syncs).toHaveLength(1);
    const sync = syncs[0];
    expect(sync.name).toBe('KernelResolverFetchesData');
    // Then clause should have ?concept/?action
    expect(sync.then[0].concept).toBe('?concept');
    expect(sync.then[0].action).toBe('?action');
    console.log('Fetch sync when:', JSON.stringify(sync.when, null, 2));
    console.log('Fetch sync then:', JSON.stringify(sync.then, null, 2));
  });

  it('parses the view-resolve-tracks-items sync with ?concept/?action in when', () => {
    const src = readFileSync('clef-base/suites/view-resolver/syncs/view-resolve-tracks-items.sync', 'utf-8');
    const syncs = parseSyncFile(src);
    expect(syncs).toHaveLength(1);
    const sync = syncs[0];
    expect(sync.name).toBe('ViewResolveTracksItems');
    // Second when pattern should have ?concept/?action
    expect(sync.when[1].concept).toBe('?concept');
    expect(sync.when[1].action).toBe('?action');
    console.log('Track sync when:', JSON.stringify(sync.when, null, 2));
  });

  it('matches ?concept/?action in when-clause against any completion', () => {
    const sync = parseSyncFile(
      readFileSync('clef-base/suites/view-resolver/syncs/view-resolve-tracks-items.sync', 'utf-8')
    )[0] as CompiledSync;

    const kernelCompletion: ActionCompletion = {
      id: 'c1',
      concept: 'urn:clef/KernelViewResolver',
      action: 'resolve',
      input: { view: 'test-view' },
      variant: 'ok',
      output: { variant: 'ok', view: 'test-view' },
      flow: 'f1',
      timestamp: Date.now(),
    };

    const contentCompletion: ActionCompletion = {
      id: 'c2',
      concept: 'ContentNode',
      action: 'list',
      input: {},
      variant: 'ok',
      output: { variant: 'ok', items: '[{"id":"1"}]' },
      flow: 'f1',
      timestamp: Date.now(),
    };

    // Match should succeed: c2 triggers, c1 is in completions
    const bindings = matchWhenClause(sync.when, [kernelCompletion, contentCompletion], contentCompletion);
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings[0].view).toBe('test-view');
    expect(bindings[0].data).toBe('[{"id":"1"}]');
    expect(bindings[0].concept).toBe('ContentNode');
    expect(bindings[0].action).toBe('list');
  });
});
