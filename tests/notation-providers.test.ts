// Notation provider handler tests -- register() and getDefinition() for all 9 notation providers.
// Each provider defines node_types, edge_types, and connection_rules for its diagram notation.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { flowchartNotationHandler } from '../handlers/ts/flowchart-notation.handler.js';
import { bpmnNotationHandler } from '../handlers/ts/bpmn-notation.handler.js';
import { conceptMapNotationHandler } from '../handlers/ts/concept-map-notation.handler.js';
import { mindMapNotationHandler } from '../handlers/ts/mind-map-notation.handler.js';
import { umlClassNotationHandler } from '../handlers/ts/uml-class-notation.handler.js';
import { statechartNotationHandler } from '../handlers/ts/statechart-notation.handler.js';
import { c4NotationHandler } from '../handlers/ts/c4-notation.handler.js';
import { erdNotationHandler } from '../handlers/ts/erd-notation.handler.js';
import { causalLoopNotationHandler } from '../handlers/ts/causal-loop-notation.handler.js';

/** Wrap in-memory storage with a `list` method used by diagramming handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

/** Shape of a notation definition returned by getDefinition(). */
interface NotationDef {
  name: string;
  description: string;
  node_types: Array<{ type_key: string; label: string; shape: string }>;
  edge_types: Array<{ type_key: string; label: string; line_style: string; arrow_type: string }>;
  connection_rules: Array<Record<string, unknown>>;
  preferred_layout: string;
}

/**
 * Reusable test suite for a notation provider handler.
 * Validates register() stores the provider and getDefinition() returns
 * the expected node_types, edge_types, and connection_rules.
 */
function describeNotationProvider(
  name: string,
  handler: { register: Function; getDefinition: Function },
  expected: {
    nodeTypeKeys: string[];
    edgeTypeKeys: string[];
    connectionRuleCount: number;
    preferredLayout: string;
  },
) {
  describe(name, () => {
    let storage: ReturnType<typeof createTestStorage>;

    beforeEach(() => {
      storage = createTestStorage();
    });

    describe('register', () => {
      it('registers with ok variant and correct category', async () => {
        const result = await handler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe(name);
        expect(result.category).toBe('diagram_notation');
      });

      it('stores provider in notation-provider relation', async () => {
        await handler.register({}, storage);
        const record = await storage.get('notation-provider', name);
        expect(record).not.toBeNull();
        expect(record!.name).toBe(name);
        expect(record!.category).toBe('diagram_notation');
      });

      it('is idempotent on repeated registration', async () => {
        const r1 = await handler.register({}, storage);
        const r2 = await handler.register({}, storage);
        expect(r1.variant).toBe('ok');
        expect(r2.variant).toBe('ok');
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('getDefinition', () => {
      it('returns ok variant with notation object', async () => {
        const result = await handler.getDefinition({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.notation).toBeDefined();
      });

      it('returns correct notation name', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        expect(notation.name).toBe(name);
      });

      it('has a non-empty description', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        expect(notation.description).toBeTruthy();
        expect(notation.description.length).toBeGreaterThan(10);
      });

      it('returns expected node type keys', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        const keys = notation.node_types.map((t) => t.type_key);
        expect(keys).toEqual(expected.nodeTypeKeys);
      });

      it('returns expected edge type keys', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        const keys = notation.edge_types.map((t) => t.type_key);
        expect(keys).toEqual(expected.edgeTypeKeys);
      });

      it('returns correct number of connection rules', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        expect(notation.connection_rules).toHaveLength(expected.connectionRuleCount);
      });

      it('returns correct preferred layout', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        expect(notation.preferred_layout).toBe(expected.preferredLayout);
      });

      it('node types have required fields', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        for (const nodeType of notation.node_types) {
          expect(nodeType.type_key).toBeTruthy();
          expect(nodeType.label).toBeTruthy();
          expect(nodeType.shape).toBeTruthy();
        }
      });

      it('edge types have required fields', async () => {
        const result = await handler.getDefinition({}, storage);
        const notation = result.notation as NotationDef;
        for (const edgeType of notation.edge_types) {
          expect(edgeType.type_key).toBeTruthy();
          expect(edgeType.label).toBeTruthy();
          expect(edgeType.line_style).toBeTruthy();
          expect(edgeType.arrow_type).toBeTruthy();
        }
      });
    });
  });
}

// ---- Flowchart ----

describeNotationProvider('flowchart', flowchartNotationHandler, {
  nodeTypeKeys: ['process', 'decision', 'terminal', 'data', 'predefined-process', 'document'],
  edgeTypeKeys: ['sequence-flow'],
  connectionRuleCount: 1,
  preferredLayout: 'hierarchical',
});

// ---- BPMN ----

describeNotationProvider('bpmn', bpmnNotationHandler, {
  nodeTypeKeys: [
    'start-event', 'end-event', 'intermediate-event',
    'task', 'user-task', 'service-task',
    'exclusive-gateway', 'parallel-gateway', 'inclusive-gateway',
    'subprocess', 'pool', 'lane',
  ],
  edgeTypeKeys: ['sequence-flow', 'message-flow', 'association'],
  connectionRuleCount: 0,
  preferredLayout: 'hierarchical',
});

// ---- Concept Map ----

describeNotationProvider('concept-map', conceptMapNotationHandler, {
  nodeTypeKeys: ['concept', 'linking-phrase'],
  edgeTypeKeys: ['proposition'],
  connectionRuleCount: 0,
  preferredLayout: 'force-directed',
});

// ---- Mind Map ----

describeNotationProvider('mind-map', mindMapNotationHandler, {
  nodeTypeKeys: ['central-topic', 'main-branch', 'sub-branch'],
  edgeTypeKeys: ['branch'],
  connectionRuleCount: 0,
  preferredLayout: 'tree',
});

// ---- UML Class ----

describeNotationProvider('uml-class', umlClassNotationHandler, {
  nodeTypeKeys: ['class', 'interface', 'abstract-class', 'enum'],
  edgeTypeKeys: ['association', 'aggregation', 'composition', 'inheritance', 'implementation', 'dependency'],
  connectionRuleCount: 0,
  preferredLayout: 'hierarchical',
});

// ---- Statechart ----

describeNotationProvider('statechart', statechartNotationHandler, {
  nodeTypeKeys: ['state', 'initial', 'final', 'composite-state'],
  edgeTypeKeys: ['transition'],
  connectionRuleCount: 0,
  preferredLayout: 'hierarchical',
});

// ---- C4 ----

describeNotationProvider('c4', c4NotationHandler, {
  nodeTypeKeys: ['person', 'system', 'container', 'component', 'external-system'],
  edgeTypeKeys: ['relationship'],
  connectionRuleCount: 0,
  preferredLayout: 'hierarchical',
});

// ---- ERD ----

describeNotationProvider('erd', erdNotationHandler, {
  nodeTypeKeys: ['entity', 'weak-entity', 'attribute', 'relationship'],
  edgeTypeKeys: ['one-to-one', 'one-to-many', 'many-to-many'],
  connectionRuleCount: 0,
  preferredLayout: 'force-directed',
});

// ---- Causal Loop ----

describeNotationProvider('causal-loop', causalLoopNotationHandler, {
  nodeTypeKeys: ['variable'],
  edgeTypeKeys: ['positive', 'negative'],
  connectionRuleCount: 1,
  preferredLayout: 'circular',
});
