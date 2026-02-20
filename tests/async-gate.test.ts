// ============================================================
// Async Gate Convention & Pattern Validation Tests
//
// Tests:
// 1. @gate annotation parsing and round-trip
// 2. Pattern validator: conforming gate concept passes
// 3. Pattern validator: non-gate concept fails gracefully
// 4. FlowTrace: gate action populates TraceNode.gate
// 5. Trace renderer: gate-annotated output (completed, pending, failed)
// 6. copf trace --gates filtering
//
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { asyncGateValidator } from '../tools/copf-cli/src/patterns/async-gate.js';
import {
  buildFlowTrace,
  renderFlowTrace,
} from '../implementations/typescript/framework/flow-trace.impl.js';
import type { FlowTrace, TraceNode, GateLookup } from '../implementations/typescript/framework/flow-trace.impl.js';
import { ActionLog, indexKey } from '../implementations/typescript/framework/engine.js';
import type { SyncIndex } from '../implementations/typescript/framework/engine.js';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import type { ConceptAST, CompiledSync, ConceptManifest } from '../kernel/src/types.js';

// ============================================================
// Test Data: A conforming gate concept (ChainMonitor)
// ============================================================

const CHAIN_MONITOR_SPEC = `
@gate
concept ChainMonitor [B] {
  purpose {
    Monitor blockchain transactions and gate downstream actions
    until finality conditions are met. Each subscription tracks
    a pending tx and completes when the condition is satisfied.
  }

  state {
    subscriptions: set B
    txHash: B -> String
    level: B -> String
    status: B -> String
  }

  actions {
    action awaitFinality(txHash: String, level: String) {
      -> ok(chain: String, block: Int, confirmations: Int) {
        The transaction has reached the required finality level.
      }
      -> reorged(txHash: String, depth: Int) {
        The transaction was affected by a chain reorganization.
      }
      -> timeout(txHash: String) {
        The transaction did not reach finality within the timeout.
      }
    }
  }
}
`;

// A non-gate concept for negative testing
const ECHO_SPEC = `
concept Echo [M] {
  purpose {
    Accept a message and echo it back.
  }

  state {
    messages: set M
    text: M -> String
  }

  actions {
    action send(id: M, text: String) {
      -> ok(id: M, echo: String) {
        Store the message and return the text as-is.
      }
    }
  }
}
`;

// A concept that looks like a gate but is missing @gate annotation
const UNLABELED_GATE_SPEC = `
concept FreshnessGate [F] {
  purpose {
    Check data freshness before allowing downstream actions.
  }

  state {
    checks: set F
    staleness: F -> Int
  }

  actions {
    action check(dataId: String, maxAge: Int) {
      -> ok(dataId: String, age: Int) {
        Data is fresh enough.
      }
      -> stale(dataId: String, age: Int) {
        Data is too old.
      }
    }
  }
}
`;

// ============================================================
// 1. @gate Annotation Parsing
// ============================================================

describe('@gate annotation parsing', () => {
  it('parses @gate annotation on concept', () => {
    const ast = parseConceptFile(CHAIN_MONITOR_SPEC);
    expect(ast.name).toBe('ChainMonitor');
    expect(ast.annotations).toBeDefined();
    expect(ast.annotations!.gate).toBe(true);
  });

  it('concepts without @gate have no gate annotation', () => {
    const ast = parseConceptFile(ECHO_SPEC);
    expect(ast.annotations?.gate).toBeFalsy();
  });

  it('@gate annotation round-trips through ConceptAST', () => {
    const ast = parseConceptFile(CHAIN_MONITOR_SPEC);
    // Serialize and deserialize (simulating storage)
    const serialized = JSON.parse(JSON.stringify(ast));
    expect(serialized.annotations.gate).toBe(true);
    expect(serialized.name).toBe('ChainMonitor');
  });

  it('preserves @version alongside @gate (inside body)', () => {
    const source = `
@gate
concept Versioned [V] {
  @version(2)
  purpose { A versioned gate concept. }
  state { items: set V }
  actions {
    action check(id: String) {
      -> ok(id: String) { Passed. }
      -> failed(reason: String) { Did not pass. }
    }
  }
}
`;
    const ast = parseConceptFile(source);
    expect(ast.annotations?.gate).toBe(true);
    expect(ast.version).toBe(2);
  });
});

// ============================================================
// 2. @gate → ConceptManifest round-trip
// ============================================================

describe('@gate in ConceptManifest', () => {
  it('propagates gate: true to manifest', async () => {
    const ast = parseConceptFile(CHAIN_MONITOR_SPEC);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.gate).toBe(true);
  });

  it('non-gate concepts have no gate field in manifest', async () => {
    const ast = parseConceptFile(ECHO_SPEC);
    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.gate).toBeUndefined();
  });
});

// ============================================================
// 3. async-gate Pattern Validator
// ============================================================

describe('async-gate pattern validator', () => {
  it('validates a conforming gate concept', () => {
    const ast = parseConceptFile(CHAIN_MONITOR_SPEC);
    const result = asyncGateValidator(ast);

    expect(result.pattern).toBe('async-gate');

    const errors = result.messages.filter(m => m.level === 'error');
    const infos = result.messages.filter(m => m.level === 'info');

    expect(errors).toHaveLength(0);
    expect(infos.length).toBeGreaterThanOrEqual(4);

    // Check specific info messages
    expect(infos.some(m => m.message.includes('@gate annotation'))).toBe(true);
    expect(infos.some(m => m.message.includes('ok variant'))).toBe(true);
    expect(infos.some(m => m.message.includes('non-ok variant'))).toBe(true);
    expect(infos.some(m => m.message.includes('pending requests'))).toBe(true);
  });

  it('gate concept with timeout variant has no timeout warning', () => {
    const ast = parseConceptFile(CHAIN_MONITOR_SPEC);
    const result = asyncGateValidator(ast);

    const warnings = result.messages.filter(m => m.level === 'warning');
    // ChainMonitor's awaitFinality has a timeout variant, so no timeout warning
    expect(warnings.some(m => m.message.includes("timeout variant to 'awaitFinality'"))).toBe(false);
  });

  it('non-gate concept fails validation', () => {
    const ast = parseConceptFile(ECHO_SPEC);
    const result = asyncGateValidator(ast);

    const errors = result.messages.filter(m => m.level === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(m => m.message.includes('Missing @gate'))).toBe(true);
  });

  it('unlabeled gate-like concept gets suggestion warning', () => {
    const ast = parseConceptFile(UNLABELED_GATE_SPEC);
    const result = asyncGateValidator(ast);

    const errors = result.messages.filter(m => m.level === 'error');
    const warnings = result.messages.filter(m => m.level === 'warning');

    // Should have error for missing @gate
    expect(errors.some(m => m.message.includes('Missing @gate'))).toBe(true);
    // Should suggest adding @gate since shape matches
    expect(warnings.some(m => m.message.includes('consider adding it'))).toBe(true);
  });

  it('warns about actions missing timeout variant', () => {
    const source = `
@gate
concept ApprovalQueue [A] {
  purpose { Queue items for human approval. }
  state {
    queue: set A
    status: A -> String
  }
  actions {
    action submit(item: String) {
      -> ok(id: String) { Approved. }
      -> rejected(reason: String) { Rejected. }
    }
  }
}
`;
    const ast = parseConceptFile(source);
    const result = asyncGateValidator(ast);

    const warnings = result.messages.filter(m => m.level === 'warning');
    expect(warnings.some(m =>
      m.message.includes("timeout variant to 'submit'"),
    )).toBe(true);
  });
});

// ============================================================
// 4. Gate-aware FlowTrace Builder
// ============================================================

describe('Gate-aware FlowTrace builder', () => {
  function createSyncIndex(syncs: CompiledSync[]): SyncIndex {
    const index: SyncIndex = new Map();
    for (const sync of syncs) {
      for (const pattern of sync.when) {
        const key = indexKey(pattern.concept, pattern.action);
        const list = index.get(key) || [];
        list.push(sync);
        index.set(key, list);
      }
    }
    return index;
  }

  // A gate concept AST for the lookup
  const chainMonitorAst = parseConceptFile(CHAIN_MONITOR_SPEC);

  const gateLookup: GateLookup = (uri: string) => {
    if (uri === 'urn:copf/ChainMonitor') return chainMonitorAst;
    return undefined;
  };

  it('populates TraceNode.gate for completed gate action', () => {
    const log = new ActionLog();
    const flowId = 'flow-gate-001';

    // Root: ArbitrumVault/lock → ok
    log.append({
      id: 'c1',
      concept: 'urn:copf/ArbitrumVault',
      action: 'lock',
      input: { amount: 100 },
      variant: 'ok',
      output: { txHash: '0xabc' },
      flow: flowId,
      timestamp: new Date(Date.now() - 60000).toISOString(),
    });

    // Invocation: ChainMonitor/awaitFinality (triggered by sync)
    log.appendInvocation({
      id: 'i1',
      concept: 'urn:copf/ChainMonitor',
      action: 'awaitFinality',
      input: { txHash: '0xabc', level: 'l1-batch' },
      flow: flowId,
      sync: 'WaitForFinality',
      timestamp: new Date(Date.now() - 59000).toISOString(),
    }, 'c1');

    // Completion: ChainMonitor/awaitFinality → ok (with description)
    log.append({
      id: 'c2',
      concept: 'urn:copf/ChainMonitor',
      action: 'awaitFinality',
      input: { txHash: '0xabc', level: 'l1-batch' },
      variant: 'ok',
      output: {
        chain: 'Arbitrum',
        block: 4891,
        confirmations: 12,
        description: 'Arbitrum batch #4891 posted to L1',
      },
      flow: flowId,
      timestamp: new Date(Date.now() - 1000).toISOString(),
    }, 'i1');

    const syncs: CompiledSync[] = [{
      name: 'WaitForFinality',
      when: [{
        concept: 'urn:copf/ArbitrumVault',
        action: 'lock',
        inputFields: [],
        outputFields: [{ name: 'txHash', match: { type: 'variable', name: 'tx' } }],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/ChainMonitor',
        action: 'awaitFinality',
        fields: [
          { name: 'txHash', value: { type: 'variable', name: 'tx' } },
          { name: 'level', value: { type: 'literal', value: 'l1-batch' } },
        ],
      }],
    }];

    const syncIndex = createSyncIndex(syncs);
    const trace = buildFlowTrace(flowId, log, syncIndex, syncs, gateLookup);

    expect(trace).not.toBeNull();
    expect(trace!.status).toBe('ok');

    // Find the gate node
    const gateNode = findNodeByAction(trace!.root, 'ChainMonitor/awaitFinality');
    expect(gateNode).toBeDefined();
    expect(gateNode!.gate).toBeDefined();
    expect(gateNode!.gate!.pending).toBe(false);
    expect(gateNode!.gate!.waitDescription).toBe('Arbitrum batch #4891 posted to L1');
  });

  it('creates pending gate node for incomplete gate action', () => {
    const log = new ActionLog();
    const flowId = 'flow-gate-002';

    // Root completion
    log.append({
      id: 'c1',
      concept: 'urn:copf/ArbitrumVault',
      action: 'lock',
      input: { amount: 100 },
      variant: 'ok',
      output: { txHash: '0xdef' },
      flow: flowId,
      timestamp: new Date(Date.now() - 200000).toISOString(),
    });

    // Invocation for gate — no completion yet (pending)
    log.appendInvocation({
      id: 'i1',
      concept: 'urn:copf/ChainMonitor',
      action: 'awaitFinality',
      input: { txHash: '0xdef', level: 'l1-batch' },
      flow: flowId,
      sync: 'WaitForFinality',
      timestamp: new Date(Date.now() - 199000).toISOString(),
    }, 'c1');

    const syncs: CompiledSync[] = [{
      name: 'WaitForFinality',
      when: [{
        concept: 'urn:copf/ArbitrumVault',
        action: 'lock',
        inputFields: [],
        outputFields: [],
      }],
      where: [],
      then: [{
        concept: 'urn:copf/ChainMonitor',
        action: 'awaitFinality',
        fields: [
          { name: 'txHash', value: { type: 'variable', name: 'tx' } },
          { name: 'level', value: { type: 'literal', value: 'l1-batch' } },
        ],
      }],
    }];

    const syncIndex = createSyncIndex(syncs);
    const trace = buildFlowTrace(flowId, log, syncIndex, syncs, gateLookup);

    expect(trace).not.toBeNull();

    // The WaitForFinality sync should have fired and produced a pending child
    const waitSync = trace!.root.children.find(c => c.syncName === 'WaitForFinality');
    expect(waitSync).toBeDefined();
    expect(waitSync!.fired).toBe(true);
    expect(waitSync!.child).toBeDefined();
    expect(waitSync!.child!.gate).toBeDefined();
    expect(waitSync!.child!.gate!.pending).toBe(true);
    expect(waitSync!.child!.variant).toBe('pending');
  });

  it('populates gate.progress from completion fields', () => {
    const log = new ActionLog();
    const flowId = 'flow-gate-003';

    log.append({
      id: 'c1',
      concept: 'urn:copf/ChainMonitor',
      action: 'awaitFinality',
      input: { txHash: '0xghi', level: 'l1-batch' },
      variant: 'ok',
      output: {
        chain: 'Arbitrum',
        block: 5000,
        confirmations: 12,
        progressCurrent: 900,
        progressTarget: 900,
        progressUnit: 'blocks',
      },
      flow: flowId,
      timestamp: new Date().toISOString(),
    });

    const syncs: CompiledSync[] = [];
    const syncIndex = createSyncIndex(syncs);
    const trace = buildFlowTrace(flowId, log, syncIndex, syncs, gateLookup);

    expect(trace).not.toBeNull();
    expect(trace!.root.gate).toBeDefined();
    expect(trace!.root.gate!.progress).toBeDefined();
    expect(trace!.root.gate!.progress!.current).toBe(900);
    expect(trace!.root.gate!.progress!.target).toBe(900);
    expect(trace!.root.gate!.progress!.unit).toBe('blocks');
  });

  it('non-gate actions have no gate field', () => {
    const log = new ActionLog();
    const flowId = 'flow-nogate';

    log.append({
      id: 'c1',
      concept: 'urn:copf/Echo',
      action: 'send',
      input: { id: '1', text: 'hello' },
      variant: 'ok',
      output: { id: '1', echo: 'hello' },
      flow: flowId,
      timestamp: new Date().toISOString(),
    });

    const syncs: CompiledSync[] = [];
    const syncIndex = createSyncIndex(syncs);
    const trace = buildFlowTrace(flowId, log, syncIndex, syncs, gateLookup);

    expect(trace).not.toBeNull();
    expect(trace!.root.gate).toBeUndefined();
  });
});

// ============================================================
// 5. Gate-aware Trace Renderer
// ============================================================

describe('Gate-aware trace renderer', () => {
  it('renders completed gate with ⏳ icon and "(async gate)" label', () => {
    const trace: FlowTrace = {
      flowId: 'flow-render-001',
      status: 'ok',
      durationMs: 863000, // ~14m 23s
      root: {
        action: 'ArbitrumVault/lock',
        variant: 'ok',
        durationMs: 2300,
        fields: { txHash: '0xabc' },
        children: [{
          syncName: 'WaitForFinality',
          fired: true,
          child: {
            action: 'ChainMonitor/awaitFinality',
            variant: 'ok',
            durationMs: 858000,
            fields: {
              chain: 'Arbitrum',
              block: 4891,
              confirmations: 12,
            },
            children: [],
            gate: {
              pending: false,
              waitDescription: 'Arbitrum batch #4891 posted to L1',
            },
          },
        }],
      },
    };

    const output = renderFlowTrace(trace);

    // Check ⏳ icon appears (not ✅)
    expect(output).toContain('\u23F3');
    expect(output).toContain('(async gate)');
    expect(output).toContain('ChainMonitor/awaitFinality');
    // Check human-friendly duration
    expect(output).toContain('14m 18s');
    // Check "waited for:" line
    expect(output).toContain('waited for: Arbitrum batch #4891 posted to L1');
    // Root should still use ✅
    expect(output).toContain('\u2705');
  });

  it('renders pending gate with pending label', () => {
    const trace: FlowTrace = {
      flowId: 'flow-render-002',
      status: 'ok',
      durationMs: 192000,
      root: {
        action: 'ArbitrumVault/lock',
        variant: 'ok',
        durationMs: 2100,
        fields: {},
        children: [{
          syncName: 'WaitForFinality',
          fired: true,
          child: {
            action: 'ChainMonitor/awaitFinality',
            variant: 'pending',
            durationMs: 190000,
            fields: { txHash: '0xdef', level: 'l1-batch' },
            children: [{
              syncName: 'BridgeAfterFinality',
              fired: false,
              missingPattern: 'waiting on: ChainMonitor/awaitFinality',
              blocked: 'waiting on: ChainMonitor/awaitFinality \u2192 ok',
            }],
            gate: {
              pending: true,
              progress: {
                current: 847,
                target: 900,
                unit: 'blocks',
              },
            },
          },
        }],
      },
    };

    const output = renderFlowTrace(trace);

    expect(output).toContain('(async gate, pending)');
    expect(output).toContain('status: 847/~900 blocks');
    // Blocked sync should use ⏸ icon
    expect(output).toContain('\u23F8');
    expect(output).toContain('[BridgeAfterFinality] blocked');
  });

  it('renders failed gate with FAILED label', () => {
    const trace: FlowTrace = {
      flowId: 'flow-render-003',
      status: 'failed',
      durationMs: 465000,
      root: {
        action: 'ArbitrumVault/lock',
        variant: 'ok',
        durationMs: 2000,
        fields: {},
        children: [{
          syncName: 'WaitForFinality',
          fired: true,
          child: {
            action: 'ChainMonitor/awaitFinality',
            variant: 'reorged',
            durationMs: 463000,
            fields: {
              txHash: '0xabc',
              depth: 3,
            },
            children: [],
            gate: {
              pending: false,
            },
          },
        }],
      },
    };

    const output = renderFlowTrace(trace);

    expect(output).toContain('(async gate, FAILED)');
    expect(output).toContain('reorged');
    expect(output).toContain('txHash: "0xabc"');
    expect(output).toContain('depth: 3');
  });

  it('--gates flag filters to only gate steps', () => {
    const trace: FlowTrace = {
      flowId: 'flow-gates-filter',
      status: 'ok',
      durationMs: 900000,
      root: {
        action: 'ArbitrumVault/lock',
        variant: 'ok',
        durationMs: 2000,
        fields: {},
        children: [
          {
            syncName: 'LogAction',
            fired: true,
            child: {
              action: 'ActionLog/append',
              variant: 'ok',
              durationMs: 1,
              fields: {},
              children: [],
            },
          },
          {
            syncName: 'WaitForFinality',
            fired: true,
            child: {
              action: 'ChainMonitor/awaitFinality',
              variant: 'ok',
              durationMs: 858000,
              fields: {},
              children: [],
              gate: {
                pending: false,
                waitDescription: 'Batch posted',
              },
            },
          },
        ],
      },
    };

    const output = renderFlowTrace(trace, { gates: true });

    // Gate step should appear
    expect(output).toContain('ChainMonitor/awaitFinality');
    // Non-gate step should be filtered out
    expect(output).not.toContain('ActionLog/append');
  });

  it('JSON output includes gate field', () => {
    const trace: FlowTrace = {
      flowId: 'flow-json',
      status: 'ok',
      durationMs: 100,
      root: {
        action: 'ChainMonitor/awaitFinality',
        variant: 'ok',
        durationMs: 100,
        fields: {},
        children: [],
        gate: { pending: false, waitDescription: 'done' },
      },
    };

    const output = renderFlowTrace(trace, { json: true });
    const parsed = JSON.parse(output);

    expect(parsed.root.gate).toBeDefined();
    expect(parsed.root.gate.pending).toBe(false);
    expect(parsed.root.gate.waitDescription).toBe('done');
  });
});

// ============================================================
// Helpers
// ============================================================

function findNodeByAction(node: TraceNode, action: string): TraceNode | undefined {
  if (node.action === action) return node;
  for (const child of node.children) {
    if (child.child) {
      const found = findNodeByAction(child.child, action);
      if (found) return found;
    }
  }
  return undefined;
}
