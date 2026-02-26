// ============================================================
// Observability & Hot Reloading Tests
//
// Tests for:
// 1. Telemetry concept — export action records as OTel spans
// 2. SyncEngine.reloadSyncs() — atomic index swap
// 3. Registry.reloadConcept() — transport swap
// 4. Registry.deregisterConcept() — concept removal
// 5. Degraded sync skipping and un-degrading
// 6. copf dev file watcher integration
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInMemoryStorage,
  createInProcessAdapter,
  createConceptRegistry,
} from '@clef/kernel';
import { createKernel } from '../handlers/ts/framework/kernel-factory';
import { SyncEngine, ActionLog, buildSyncIndex } from '../handlers/ts/framework/sync-engine.handler';
import type { CompiledSync, ConceptHandler, ActionCompletion } from '@clef/kernel';
import { generateId, timestamp } from '../kernel/src/types';
import {
  telemetryHandler,
  getExportedSpans,
  clearExportedSpans,
} from '../handlers/ts/framework/telemetry.handler';

// --- Telemetry Concept Tests ---

describe('Telemetry Concept', () => {
  beforeEach(() => {
    clearExportedSpans();
  });

  it('exports an action record as a telemetry span', async () => {
    const storage = createInMemoryStorage();
    const record = {
      id: 'rec-001',
      type: 'completion',
      concept: 'urn:copf/User',
      action: 'register',
      input: { user: 'u-1', name: 'alice' },
      variant: 'ok',
      output: { user: 'u-1' },
      flow: 'flow-001',
      timestamp: new Date().toISOString(),
    };

    const result = await telemetryHandler.export(
      { record },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.spanId).toBeDefined();

    // Check exported spans
    const spans = getExportedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].traceId).toBe('flow-001');
    expect(spans[0].spanId).toBe('rec-001');
    expect(spans[0].name).toBe('User/register');
    expect(spans[0].status).toBe('OK');
  });

  it('maps error variant to ERROR status', async () => {
    const storage = createInMemoryStorage();
    const record = {
      id: 'rec-002',
      type: 'completion',
      concept: 'urn:copf/User',
      action: 'register',
      variant: 'error',
      output: { message: 'name already taken' },
      flow: 'flow-002',
      timestamp: new Date().toISOString(),
    };

    await telemetryHandler.export({ record }, storage);

    const spans = getExportedSpans();
    expect(spans[0].status).toBe('ERROR');
  });

  it('maps invocation records to UNSET status', async () => {
    const storage = createInMemoryStorage();
    const record = {
      id: 'inv-001',
      type: 'invocation',
      concept: 'urn:copf/User',
      action: 'register',
      input: { user: 'u-1' },
      flow: 'flow-003',
      sync: 'RegisterUser',
      timestamp: new Date().toISOString(),
    };

    await telemetryHandler.export({ record }, storage);

    const spans = getExportedSpans();
    expect(spans[0].status).toBe('UNSET');
    expect(spans[0].links?.[0]?.syncName).toBe('RegisterUser');
  });

  it('includes parent span ID from provenance edges', async () => {
    const storage = createInMemoryStorage();
    const record = {
      id: 'rec-003',
      type: 'completion',
      concept: 'urn:copf/Password',
      action: 'validate',
      variant: 'ok',
      output: { valid: true },
      flow: 'flow-004',
      parent: 'inv-parent-001',
      timestamp: new Date().toISOString(),
    };

    await telemetryHandler.export({ record }, storage);

    const spans = getExportedSpans();
    expect(spans[0].parentSpanId).toBe('inv-parent-001');
  });

  it('stores span attributes from input/output fields', async () => {
    const storage = createInMemoryStorage();
    const record = {
      id: 'rec-004',
      type: 'completion',
      concept: 'urn:copf/Echo',
      action: 'send',
      input: { text: 'hello' },
      variant: 'ok',
      output: { echo: 'hello' },
      flow: 'flow-005',
      timestamp: new Date().toISOString(),
    };

    await telemetryHandler.export({ record }, storage);

    const spans = getExportedSpans();
    expect(spans[0].attributes['copf.input.text']).toBe('hello');
    expect(spans[0].attributes['copf.output.echo']).toBe('hello');
    expect(spans[0].attributes['copf.variant']).toBe('ok');
  });

  it('handles missing record gracefully', async () => {
    const storage = createInMemoryStorage();
    const result = await telemetryHandler.export({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.spanId).toBe('no-record');
  });

  it('configures exporter type', async () => {
    const storage = createInMemoryStorage();
    const result = await telemetryHandler.configure(
      { exporter: { type: 'otlp', endpoint: 'http://localhost:4318' } },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('exports multiple spans for a flow', async () => {
    const storage = createInMemoryStorage();

    // Simulate a flow with multiple actions
    const records = [
      { id: 'r1', type: 'completion', concept: 'urn:copf/Web', action: 'request', variant: 'ok', output: {}, flow: 'flow-multi', timestamp: new Date().toISOString() },
      { id: 'r2', type: 'invocation', concept: 'urn:copf/Echo', action: 'send', flow: 'flow-multi', sync: 'HandleEcho', parent: 'r1', timestamp: new Date().toISOString() },
      { id: 'r3', type: 'completion', concept: 'urn:copf/Echo', action: 'send', variant: 'ok', output: { echo: 'hi' }, flow: 'flow-multi', parent: 'r2', timestamp: new Date().toISOString() },
    ];

    for (const record of records) {
      await telemetryHandler.export({ record }, storage);
    }

    const spans = getExportedSpans();
    expect(spans.length).toBe(3);
    // All should share the same trace ID (flow ID)
    expect(spans.every(s => s.traceId === 'flow-multi')).toBe(true);
  });
});

// --- SyncEngine.reloadSyncs() Tests ---

describe('SyncEngine.reloadSyncs()', () => {
  function makeSync(name: string, concept: string, action: string): CompiledSync {
    return {
      name,
      when: [{
        concept, action,
        inputFields: [],
        outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:test/Target', action: 'run',
        fields: [],
      }],
    };
  }

  it('atomically replaces the sync index', () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    // Register initial syncs
    engine.registerSync(makeSync('SyncA', 'urn:test/A', 'doA'));
    engine.registerSync(makeSync('SyncB', 'urn:test/B', 'doB'));

    expect(engine.getRegisteredSyncs().length).toBe(2);

    // Reload with new set
    engine.reloadSyncs([
      makeSync('SyncC', 'urn:test/C', 'doC'),
      makeSync('SyncD', 'urn:test/D', 'doD'),
      makeSync('SyncE', 'urn:test/E', 'doE'),
    ]);

    const syncs = engine.getRegisteredSyncs();
    expect(syncs.length).toBe(3);
    expect(syncs.map(s => s.name).sort()).toEqual(['SyncC', 'SyncD', 'SyncE']);
  });

  it('clears degraded syncs on reload', () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    engine.registerSync(makeSync('SyncA', 'urn:test/A', 'doA'));
    engine.degradeSyncsForConcept('urn:test/A');
    expect(engine.isSyncDegraded('SyncA')).toBe(true);

    // Reload clears degraded state
    engine.reloadSyncs([makeSync('SyncA', 'urn:test/A', 'doA')]);
    expect(engine.isSyncDegraded('SyncA')).toBe(false);
  });

  it('new completions use the new sync index after reload', async () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    // Register a handler for the target concept
    const results: string[] = [];
    const targetHandler: ConceptHandler = {
      async run(input) {
        results.push(input.source as string);
        return { variant: 'ok' };
      },
    };
    registry.register('urn:test/Target', createInProcessAdapter(targetHandler, createInMemoryStorage()));

    // Initial sync: listens for A/doA
    engine.registerSync({
      name: 'SyncA',
      when: [{
        concept: 'urn:test/A', action: 'doA',
        inputFields: [], outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:test/Target', action: 'run',
        fields: [{ name: 'source', value: { type: 'literal', value: 'from-A' } }],
      }],
    });

    // Fire A/doA — should trigger SyncA
    const completion1: ActionCompletion = {
      id: generateId(), concept: 'urn:test/A', action: 'doA',
      input: {}, variant: 'ok', output: {},
      flow: 'flow-1', timestamp: timestamp(),
    };
    const inv1 = await engine.onCompletion(completion1);
    expect(inv1.length).toBe(1);

    // Reload with a different sync: listens for B/doB instead
    engine.reloadSyncs([{
      name: 'SyncB',
      when: [{
        concept: 'urn:test/B', action: 'doB',
        inputFields: [], outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:test/Target', action: 'run',
        fields: [{ name: 'source', value: { type: 'literal', value: 'from-B' } }],
      }],
    }]);

    // Fire A/doA again — should NOT trigger (SyncA is gone)
    const completion2: ActionCompletion = {
      id: generateId(), concept: 'urn:test/A', action: 'doA',
      input: {}, variant: 'ok', output: {},
      flow: 'flow-2', timestamp: timestamp(),
    };
    const inv2 = await engine.onCompletion(completion2);
    expect(inv2.length).toBe(0);

    // Fire B/doB — should trigger SyncB
    const completion3: ActionCompletion = {
      id: generateId(), concept: 'urn:test/B', action: 'doB',
      input: {}, variant: 'ok', output: {},
      flow: 'flow-3', timestamp: timestamp(),
    };
    const inv3 = await engine.onCompletion(completion3);
    expect(inv3.length).toBe(1);
  });
});

// --- Registry Hot Reload Tests ---

describe('Registry Hot Reload', () => {
  it('reloadConcept swaps the transport', async () => {
    const registry = createConceptRegistry();

    // Register initial handler
    const handlerV1: ConceptHandler = {
      async greet() { return { variant: 'ok', message: 'v1' }; },
    };
    registry.register('urn:test/Greeter', createInProcessAdapter(handlerV1, createInMemoryStorage()));

    // Invoke v1
    const transport1 = registry.resolve('urn:test/Greeter')!;
    const result1 = await transport1.invoke({
      id: 'i1', concept: 'urn:test/Greeter', action: 'greet',
      input: {}, flow: 'f1', timestamp: timestamp(),
    });
    expect(result1.output.message).toBe('v1');

    // Hot-reload with v2
    const handlerV2: ConceptHandler = {
      async greet() { return { variant: 'ok', message: 'v2' }; },
    };
    registry.reloadConcept!('urn:test/Greeter', createInProcessAdapter(handlerV2, createInMemoryStorage()));

    // Invoke v2
    const transport2 = registry.resolve('urn:test/Greeter')!;
    const result2 = await transport2.invoke({
      id: 'i2', concept: 'urn:test/Greeter', action: 'greet',
      input: {}, flow: 'f2', timestamp: timestamp(),
    });
    expect(result2.output.message).toBe('v2');
  });

  it('deregisterConcept removes the transport', () => {
    const registry = createConceptRegistry();

    registry.register('urn:test/Temp', createInProcessAdapter({}, createInMemoryStorage()));
    expect(registry.available('urn:test/Temp')).toBe(true);

    const removed = registry.deregisterConcept!('urn:test/Temp');
    expect(removed).toBe(true);
    expect(registry.available('urn:test/Temp')).toBe(false);
  });

  it('deregisterConcept returns false for unknown concept', () => {
    const registry = createConceptRegistry();
    const removed = registry.deregisterConcept!('urn:test/Unknown');
    expect(removed).toBe(false);
  });
});

// --- Degraded Sync Tests ---

describe('Degraded Syncs', () => {
  function makeSync(name: string, whenConcept: string, thenConcept: string): CompiledSync {
    return {
      name,
      when: [{
        concept: whenConcept, action: 'trigger',
        inputFields: [], outputFields: [],
      }],
      where: [],
      then: [{
        concept: thenConcept, action: 'run',
        fields: [],
      }],
    };
  }

  it('marks syncs referencing a concept as degraded', () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    engine.registerSync(makeSync('SyncA', 'urn:test/Source', 'urn:test/TargetA'));
    engine.registerSync(makeSync('SyncB', 'urn:test/Source', 'urn:test/TargetB'));
    engine.registerSync(makeSync('SyncC', 'urn:test/Other', 'urn:test/TargetC'));

    // Degrade syncs referencing TargetA
    const degraded = engine.degradeSyncsForConcept('urn:test/TargetA');
    expect(degraded).toEqual(['SyncA']);
    expect(engine.isSyncDegraded('SyncA')).toBe(true);
    expect(engine.isSyncDegraded('SyncB')).toBe(false);
    expect(engine.isSyncDegraded('SyncC')).toBe(false);
  });

  it('skips degraded syncs during matching', async () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    // Register target handler
    registry.register('urn:test/Target', createInProcessAdapter({
      async run() { return { variant: 'ok' }; },
    }, createInMemoryStorage()));

    engine.registerSync(makeSync('DegradedSync', 'urn:test/Source', 'urn:test/Target'));

    // Mark as degraded
    engine.degradeSyncsForConcept('urn:test/Target');

    // Suppress the warning log during test
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Fire a completion — degraded sync should be skipped
    const completion: ActionCompletion = {
      id: generateId(), concept: 'urn:test/Source', action: 'trigger',
      input: {}, variant: 'ok', output: {},
      flow: 'flow-degraded', timestamp: timestamp(),
    };
    const invocations = await engine.onCompletion(completion);
    expect(invocations.length).toBe(0);

    // Should have logged a warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping degraded sync: DegradedSync'),
    );

    warnSpy.mockRestore();
  });

  it('un-degrades syncs when concept re-registers', () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    engine.registerSync(makeSync('SyncA', 'urn:test/Source', 'urn:test/Target'));

    // Degrade
    engine.degradeSyncsForConcept('urn:test/Target');
    expect(engine.isSyncDegraded('SyncA')).toBe(true);

    // Un-degrade (concept re-registered)
    const undegraded = engine.undegradeSyncsForConcept('urn:test/Target');
    expect(undegraded).toEqual(['SyncA']);
    expect(engine.isSyncDegraded('SyncA')).toBe(false);
  });

  it('getDegradedSyncs returns all degraded sync names', () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    engine.registerSync(makeSync('S1', 'urn:test/A', 'urn:test/Gone'));
    engine.registerSync(makeSync('S2', 'urn:test/B', 'urn:test/Gone'));
    engine.registerSync(makeSync('S3', 'urn:test/C', 'urn:test/OK'));

    engine.degradeSyncsForConcept('urn:test/Gone');
    expect(engine.getDegradedSyncs().sort()).toEqual(['S1', 'S2']);
  });

  it('degraded syncs resume firing after un-degrading', async () => {
    const registry = createConceptRegistry();
    const log = new ActionLog();
    const engine = new SyncEngine(log, registry);

    registry.register('urn:test/Target', createInProcessAdapter({
      async run() { return { variant: 'ok' }; },
    }, createInMemoryStorage()));

    engine.registerSync(makeSync('ResumableSync', 'urn:test/Source', 'urn:test/Target'));

    // Degrade, then un-degrade
    engine.degradeSyncsForConcept('urn:test/Target');
    engine.undegradeSyncsForConcept('urn:test/Target');

    // Now the sync should fire again
    const completion: ActionCompletion = {
      id: generateId(), concept: 'urn:test/Source', action: 'trigger',
      input: {}, variant: 'ok', output: {},
      flow: 'flow-resumed', timestamp: timestamp(),
    };
    const invocations = await engine.onCompletion(completion);
    expect(invocations.length).toBe(1);
  });
});

// --- buildSyncIndex Tests ---

describe('buildSyncIndex', () => {
  it('builds an index from a sync array', () => {
    const syncs: CompiledSync[] = [
      {
        name: 'S1',
        when: [{ concept: 'urn:test/A', action: 'doA', inputFields: [], outputFields: [] }],
        where: [],
        then: [{ concept: 'urn:test/B', action: 'doB', fields: [] }],
      },
      {
        name: 'S2',
        when: [{ concept: 'urn:test/A', action: 'doA', inputFields: [], outputFields: [] }],
        where: [],
        then: [{ concept: 'urn:test/C', action: 'doC', fields: [] }],
      },
    ];

    const index = buildSyncIndex(syncs);
    const candidates = index.get('urn:test/A:doA');
    expect(candidates).toBeDefined();
    expect(candidates!.size).toBe(2);
  });
});

// --- Integration: Telemetry with Kernel ---

describe('Telemetry Integration', () => {
  beforeEach(() => {
    clearExportedSpans();
  });

  it('telemetry handler works as a registered concept in the kernel', async () => {
    const kernel = createKernel();
    kernel.registerConcept('urn:copf/Telemetry', telemetryHandler);

    // Invoke telemetry export directly
    const result = await kernel.invokeConcept('urn:copf/Telemetry', 'export', {
      record: {
        id: 'test-rec',
        type: 'completion',
        concept: 'urn:copf/Echo',
        action: 'send',
        variant: 'ok',
        output: { echo: 'test' },
        flow: 'flow-integration',
        timestamp: new Date().toISOString(),
      },
    });

    expect(result.variant).toBe('ok');
    expect(result.spanId).toBe('test-rec');

    const spans = getExportedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].name).toBe('Echo/send');
  });
});
