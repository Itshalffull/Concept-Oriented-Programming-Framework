// ============================================================
// SyncEngine Tests
//
// Validates the SyncEngine concept — spec parsing, handler
// behavior (registerSync, onCompletion), and sync evaluation.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
  createConceptRegistry,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import type {
  ConceptAST,
  CompiledSync,
  ActionCompletion,
} from '../kernel/src/types.js';
import { generateId, timestamp } from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';

// Stage 3: SyncEngine concept handler
import { createSyncEngineHandler } from '../implementations/typescript/framework/sync-engine.impl.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// ============================================================
// 1. SyncEngine Concept Spec
// ============================================================

describe('Stage 3 — SyncEngine Concept Spec', () => {
  it('parses the SyncEngine concept spec', () => {
    const source = readSpec('framework', 'sync-engine');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('SyncEngine');
    expect(ast.typeParams).toEqual(['F']);
    expect(ast.state).toHaveLength(4); // syncs, pendingFlows, pendingQueue, conflicts
    expect(ast.actions).toHaveLength(6); // registerSync, onCompletion, evaluateWhere, queueSync, onAvailabilityChange, drainConflicts

    expect(ast.actions[0].name).toBe('registerSync');
    expect(ast.actions[0].variants).toHaveLength(1); // ok

    expect(ast.actions[1].name).toBe('onCompletion');
    expect(ast.actions[1].variants).toHaveLength(1); // ok

    expect(ast.actions[2].name).toBe('evaluateWhere');
    expect(ast.actions[2].variants).toHaveLength(2); // ok, error
  });

  it('SpecParser concept parses its own SyncEngine spec', async () => {
    const storage = createInMemoryStorage();
    const source = readSpec('framework', 'sync-engine');
    const result = await specParserHandler.parse({ source }, storage);

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('SyncEngine');
  });
});

// ============================================================
// 2. SyncEngine Concept Handler
// ============================================================

describe('Stage 3 — SyncEngine Concept Handler', () => {
  it('registerSync stores a sync definition', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    const sync: CompiledSync = {
      name: 'TestSync',
      when: [{
        concept: 'urn:copf/Test',
        action: 'do',
        inputFields: [],
        outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/Other',
        action: 'respond',
        fields: [],
      }],
    };

    const result = await handler.registerSync({ sync }, storage);
    expect(result.variant).toBe('ok');
  });

  it('onCompletion returns empty invocations when no syncs match', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Unknown',
      action: 'nothing',
      input: {},
      variant: 'ok',
      output: {},
      flow: generateId(),
      timestamp: timestamp(),
    };

    const result = await handler.onCompletion({ completion }, storage);
    expect(result.variant).toBe('ok');
    expect(result.invocations).toEqual([]);
  });

  it('onCompletion produces invocations when a sync matches', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    // Register a simple sync: when Test/do completes, invoke Other/respond
    const sync: CompiledSync = {
      name: 'TestReact',
      when: [{
        concept: 'urn:copf/Test',
        action: 'do',
        inputFields: [],
        outputFields: [{ name: 'value', match: { type: 'variable', name: 'val' } }],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/Other',
        action: 'respond',
        fields: [{ name: 'data', value: { type: 'variable', name: 'val' } }],
      }],
    };

    await handler.registerSync({ sync }, storage);

    // Feed a matching completion
    const flowId = generateId();
    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/Test',
      action: 'do',
      input: {},
      variant: 'ok',
      output: { value: 'hello' },
      flow: flowId,
      timestamp: timestamp(),
    };

    const result = await handler.onCompletion({ completion }, storage);
    expect(result.variant).toBe('ok');

    const invocations = result.invocations as any[];
    expect(invocations).toHaveLength(1);
    expect(invocations[0].concept).toBe('urn:copf/Other');
    expect(invocations[0].action).toBe('respond');
    expect(invocations[0].input.data).toBe('hello');
    expect(invocations[0].flow).toBe(flowId);
    expect(invocations[0].sync).toBe('TestReact');
  });

  it('onCompletion does not re-fire a sync for the same completion', async () => {
    const registry = createConceptRegistry();
    const { handler } = createSyncEngineHandler(registry);
    const storage = createInMemoryStorage();

    const sync: CompiledSync = {
      name: 'OnceOnly',
      when: [{
        concept: 'urn:copf/A',
        action: 'x',
        inputFields: [],
        outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/B',
        action: 'y',
        fields: [],
      }],
    };

    await handler.registerSync({ sync }, storage);

    const flowId = generateId();
    const completion: ActionCompletion = {
      id: generateId(),
      concept: 'urn:copf/A',
      action: 'x',
      input: {},
      variant: 'ok',
      output: {},
      flow: flowId,
      timestamp: timestamp(),
    };

    // First call should produce invocations
    const r1 = await handler.onCompletion({ completion }, storage);
    expect((r1.invocations as any[]).length).toBe(1);

    // Second call with same completion should not re-fire
    const r2 = await handler.onCompletion({ completion }, storage);
    expect((r2.invocations as any[]).length).toBe(0);
  });
});
