// DiagramNotation concept handler tests -- create, addNodeType, addEdgeType, addConnectionRule,
// validateDiagram, getNodePalette, getEdgePalette, and applyToCanvas actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { diagramNotationHandler, resetDiagramNotationCounter } from '../handlers/ts/diagram-notation.handler.js';

/** Wrap in-memory storage with a `list` method used by diagramming handlers. */
function createTestStorage() {
  const base = createInMemoryStorage();
  return Object.assign(base, {
    async list(relation: string) {
      return base.find(relation);
    },
  });
}

describe('DiagramNotation', () => {
  let storage: ReturnType<typeof createTestStorage>;

  beforeEach(() => {
    storage = createTestStorage();
    resetDiagramNotationCounter();
  });

  describe('create', () => {
    it('creates a notation with name and description', async () => {
      const result = await diagramNotationHandler.create(
        { name: 'UML Class', description: 'UML class diagram notation' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.notation).toBe('notation-1');

      const record = await storage.get('diagram-notation', 'notation-1');
      expect(record!.name).toBe('UML Class');
      expect(record!.description).toBe('UML class diagram notation');
      expect(record!.node_types).toEqual([]);
      expect(record!.edge_types).toEqual([]);
      expect(record!.connection_rules).toEqual([]);
    });

    it('defaults description to null', async () => {
      const result = await diagramNotationHandler.create({ name: 'Flowchart' }, storage);
      const record = await storage.get('diagram-notation', result.notation as string);
      expect(record!.description).toBeNull();
    });

    it('returns error on duplicate name', async () => {
      await diagramNotationHandler.create({ name: 'UML Class' }, storage);
      const result = await diagramNotationHandler.create({ name: 'UML Class' }, storage);
      expect(result.variant).toBe('error');
      expect(result.message).toContain('already exists');
    });

    it('assigns unique IDs', async () => {
      const r1 = await diagramNotationHandler.create({ name: 'A' }, storage);
      const r2 = await diagramNotationHandler.create({ name: 'B' }, storage);
      expect(r1.notation).not.toBe(r2.notation);
    });

    it('initializes preferred_layout as null', async () => {
      const result = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const record = await storage.get('diagram-notation', result.notation as string);
      expect(record!.preferred_layout).toBeNull();
    });
  });

  describe('addNodeType', () => {
    it('adds a node type to the notation', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      const result = await diagramNotationHandler.addNodeType(
        { notation: id, type_key: 'class', label: 'Class', shape: 'rectangle' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.type_key).toBe('class');

      const record = await storage.get('diagram-notation', id);
      const nodeTypes = record!.node_types as Array<Record<string, unknown>>;
      expect(nodeTypes).toHaveLength(1);
      expect(nodeTypes[0].type_key).toBe('class');
      expect(nodeTypes[0].label).toBe('Class');
      expect(nodeTypes[0].shape).toBe('rectangle');
    });

    it('stores optional fields', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType(
        { notation: id, type_key: 'node', label: 'Node', shape: 'circle', default_fill: '#fff', default_stroke: '#000', icon: 'star', schema_id: 'schema-1' },
        storage,
      );

      const record = await storage.get('diagram-notation', id);
      const nodeTypes = record!.node_types as Array<Record<string, unknown>>;
      expect(nodeTypes[0].default_fill).toBe('#fff');
      expect(nodeTypes[0].default_stroke).toBe('#000');
      expect(nodeTypes[0].icon).toBe('star');
      expect(nodeTypes[0].schema_id).toBe('schema-1');
    });

    it('defaults optional fields to null', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType(
        { notation: id, type_key: 'node', label: 'Node', shape: 'circle' },
        storage,
      );

      const record = await storage.get('diagram-notation', id);
      const nodeTypes = record!.node_types as Array<Record<string, unknown>>;
      expect(nodeTypes[0].default_fill).toBeNull();
      expect(nodeTypes[0].default_stroke).toBeNull();
      expect(nodeTypes[0].icon).toBeNull();
      expect(nodeTypes[0].schema_id).toBeNull();
    });

    it('returns duplicate on existing type_key', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType(
        { notation: id, type_key: 'class', label: 'Class', shape: 'rectangle' },
        storage,
      );
      const result = await diagramNotationHandler.addNodeType(
        { notation: id, type_key: 'class', label: 'Class 2', shape: 'diamond' },
        storage,
      );
      expect(result.variant).toBe('duplicate');
      expect(result.message).toContain('class');
    });

    it('returns error for non-existent notation', async () => {
      const result = await diagramNotationHandler.addNodeType(
        { notation: 'nonexistent', type_key: 'class', label: 'Class', shape: 'rect' },
        storage,
      );
      expect(result.variant).toBe('error');
      expect(result.message).toContain('not found');
    });

    it('adds multiple node types', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'class', label: 'Class', shape: 'rectangle' }, storage);
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'interface', label: 'Interface', shape: 'rectangle' }, storage);

      const record = await storage.get('diagram-notation', id);
      const nodeTypes = record!.node_types as Array<Record<string, unknown>>;
      expect(nodeTypes).toHaveLength(2);
    });
  });

  describe('addEdgeType', () => {
    it('adds an edge type to the notation', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      const result = await diagramNotationHandler.addEdgeType(
        { notation: id, type_key: 'inherits', label: 'Inherits', line_style: 'solid', arrow_type: 'triangle' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.type_key).toBe('inherits');

      const record = await storage.get('diagram-notation', id);
      const edgeTypes = record!.edge_types as Array<Record<string, unknown>>;
      expect(edgeTypes).toHaveLength(1);
      expect(edgeTypes[0].type_key).toBe('inherits');
      expect(edgeTypes[0].line_style).toBe('solid');
      expect(edgeTypes[0].arrow_type).toBe('triangle');
    });

    it('returns duplicate on existing type_key', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addEdgeType(
        { notation: id, type_key: 'inherits', label: 'Inherits', line_style: 'solid', arrow_type: 'triangle' },
        storage,
      );
      const result = await diagramNotationHandler.addEdgeType(
        { notation: id, type_key: 'inherits', label: 'Inherits2', line_style: 'dashed', arrow_type: 'arrow' },
        storage,
      );
      expect(result.variant).toBe('duplicate');
    });

    it('returns error for non-existent notation', async () => {
      const result = await diagramNotationHandler.addEdgeType(
        { notation: 'nonexistent', type_key: 'edge', label: 'Edge', line_style: 'solid', arrow_type: 'arrow' },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('stores optional fields', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addEdgeType(
        { notation: id, type_key: 'dep', label: 'Dependency', line_style: 'dashed', arrow_type: 'open', default_color: '#999', requires_label: true },
        storage,
      );

      const record = await storage.get('diagram-notation', id);
      const edgeTypes = record!.edge_types as Array<Record<string, unknown>>;
      expect(edgeTypes[0].default_color).toBe('#999');
      expect(edgeTypes[0].requires_label).toBe(true);
    });

    it('defaults optional fields', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addEdgeType(
        { notation: id, type_key: 'dep', label: 'Dependency', line_style: 'dashed', arrow_type: 'open' },
        storage,
      );

      const record = await storage.get('diagram-notation', id);
      const edgeTypes = record!.edge_types as Array<Record<string, unknown>>;
      expect(edgeTypes[0].default_color).toBeNull();
      expect(edgeTypes[0].requires_label).toBe(false);
    });
  });

  describe('addConnectionRule', () => {
    it('adds a connection rule referencing existing types', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'class', label: 'Class', shape: 'rect' }, storage);
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'interface', label: 'Interface', shape: 'rect' }, storage);
      await diagramNotationHandler.addEdgeType({ notation: id, type_key: 'implements', label: 'Implements', line_style: 'dashed', arrow_type: 'triangle' }, storage);

      const result = await diagramNotationHandler.addConnectionRule(
        { notation: id, source_type: 'class', target_type: 'interface', allowed_edge_types: ['implements'] },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns invalid for non-existent source node type', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'class', label: 'Class', shape: 'rect' }, storage);

      const result = await diagramNotationHandler.addConnectionRule(
        { notation: id, source_type: 'missing', target_type: 'class', allowed_edge_types: [] },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('Source node type');
    });

    it('returns invalid for non-existent target node type', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'class', label: 'Class', shape: 'rect' }, storage);

      const result = await diagramNotationHandler.addConnectionRule(
        { notation: id, source_type: 'class', target_type: 'missing', allowed_edge_types: [] },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('Target node type');
    });

    it('returns invalid for non-existent edge type', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'class', label: 'Class', shape: 'rect' }, storage);
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'interface', label: 'Interface', shape: 'rect' }, storage);

      const result = await diagramNotationHandler.addConnectionRule(
        { notation: id, source_type: 'class', target_type: 'interface', allowed_edge_types: ['nonexistent'] },
        storage,
      );
      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('Edge type');
    });

    it('returns error for non-existent notation', async () => {
      const result = await diagramNotationHandler.addConnectionRule(
        { notation: 'nonexistent', source_type: 'a', target_type: 'b', allowed_edge_types: [] },
        storage,
      );
      expect(result.variant).toBe('error');
    });

    it('stores cardinality constraints', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'a', label: 'A', shape: 'rect' }, storage);
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'b', label: 'B', shape: 'rect' }, storage);

      await diagramNotationHandler.addConnectionRule(
        { notation: id, source_type: 'a', target_type: 'b', allowed_edge_types: [], min_outgoing: 0, max_outgoing: 5, min_incoming: 1, max_incoming: 3 },
        storage,
      );

      const record = await storage.get('diagram-notation', id);
      const rules = record!.connection_rules as Array<Record<string, unknown>>;
      expect(rules[0].min_outgoing).toBe(0);
      expect(rules[0].max_outgoing).toBe(5);
      expect(rules[0].min_incoming).toBe(1);
      expect(rules[0].max_incoming).toBe(3);
    });
  });

  describe('validateDiagram', () => {
    it('returns ok for existing notation', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const result = await diagramNotationHandler.validateDiagram(
        { canvas_id: 'canvas-1', notation: created.notation },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.canvas_id).toBe('canvas-1');
    });

    it('returns violations for non-existent notation', async () => {
      const result = await diagramNotationHandler.validateDiagram(
        { canvas_id: 'canvas-1', notation: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('violations');
      expect(result.errors).toBeDefined();
    });
  });

  describe('getNodePalette', () => {
    it('returns node types with correct fields', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType(
        { notation: id, type_key: 'class', label: 'Class', shape: 'rectangle', default_fill: '#fff', icon: 'box' },
        storage,
      );

      const result = await diagramNotationHandler.getNodePalette({ notation: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.types).toHaveLength(1);

      const type = (result.types as Array<Record<string, unknown>>)[0];
      expect(type.type_key).toBe('class');
      expect(type.label).toBe('Class');
      expect(type.shape).toBe('rectangle');
      expect(type.default_fill).toBe('#fff');
      expect(type.icon).toBe('box');
    });

    it('returns empty types for non-existent notation', async () => {
      const result = await diagramNotationHandler.getNodePalette({ notation: 'nonexistent' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.types).toEqual([]);
    });

    it('returns multiple node types', async () => {
      const created = await diagramNotationHandler.create({ name: 'Test' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'a', label: 'A', shape: 'rect' }, storage);
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'b', label: 'B', shape: 'circle' }, storage);

      const result = await diagramNotationHandler.getNodePalette({ notation: id }, storage);
      expect(result.types).toHaveLength(2);
    });
  });

  describe('getEdgePalette', () => {
    it('returns edge types with correct fields', async () => {
      const created = await diagramNotationHandler.create({ name: 'UML' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.addEdgeType(
        { notation: id, type_key: 'inherits', label: 'Inherits', line_style: 'solid', arrow_type: 'triangle', default_color: '#333' },
        storage,
      );

      const result = await diagramNotationHandler.getEdgePalette({ notation: id }, storage);
      expect(result.variant).toBe('ok');
      expect(result.types).toHaveLength(1);

      const type = (result.types as Array<Record<string, unknown>>)[0];
      expect(type.type_key).toBe('inherits');
      expect(type.label).toBe('Inherits');
      expect(type.line_style).toBe('solid');
      expect(type.arrow_type).toBe('triangle');
      expect(type.default_color).toBe('#333');
    });

    it('returns empty types for non-existent notation', async () => {
      const result = await diagramNotationHandler.getEdgePalette({ notation: 'nonexistent' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.types).toEqual([]);
    });
  });

  describe('applyToCanvas', () => {
    it('associates notation with canvas', async () => {
      const created = await diagramNotationHandler.create({ name: 'Flowchart' }, storage);
      const notationId = created.notation as string;

      const result = await diagramNotationHandler.applyToCanvas(
        { canvas_id: 'canvas-1', notation: notationId },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.canvas_id).toBe('canvas-1');
      expect(result.notation).toBe(notationId);

      const assoc = await storage.get('canvas-notation', 'canvas-1');
      expect(assoc!.notation_id).toBe(notationId);
    });

    it('returns notfound for missing notation', async () => {
      const result = await diagramNotationHandler.applyToCanvas(
        { canvas_id: 'canvas-1', notation: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('multi-step sequences', () => {
    it('create -> addNodeType -> addEdgeType -> addConnectionRule -> getNodePalette', async () => {
      // Create notation
      const created = await diagramNotationHandler.create({ name: 'ER Diagram' }, storage);
      const id = created.notation as string;
      expect(created.variant).toBe('ok');

      // Add node types
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'entity', label: 'Entity', shape: 'rectangle' }, storage);
      await diagramNotationHandler.addNodeType({ notation: id, type_key: 'relationship', label: 'Relationship', shape: 'diamond' }, storage);

      // Add edge type
      await diagramNotationHandler.addEdgeType({ notation: id, type_key: 'participates', label: 'Participates', line_style: 'solid', arrow_type: 'none' }, storage);

      // Add connection rule
      const ruleResult = await diagramNotationHandler.addConnectionRule(
        { notation: id, source_type: 'entity', target_type: 'relationship', allowed_edge_types: ['participates'] },
        storage,
      );
      expect(ruleResult.variant).toBe('ok');

      // Verify palette
      const palette = await diagramNotationHandler.getNodePalette({ notation: id }, storage);
      expect(palette.types).toHaveLength(2);

      const edgePalette = await diagramNotationHandler.getEdgePalette({ notation: id }, storage);
      expect(edgePalette.types).toHaveLength(1);
    });

    it('create -> applyToCanvas -> validateDiagram', async () => {
      const created = await diagramNotationHandler.create({ name: 'Flowchart' }, storage);
      const id = created.notation as string;

      await diagramNotationHandler.applyToCanvas({ canvas_id: 'canvas-1', notation: id }, storage);

      const validated = await diagramNotationHandler.validateDiagram(
        { canvas_id: 'canvas-1', notation: id },
        storage,
      );
      expect(validated.variant).toBe('ok');
    });

    it('create two notations, apply different canvases', async () => {
      const n1 = await diagramNotationHandler.create({ name: 'Flowchart' }, storage);
      const n2 = await diagramNotationHandler.create({ name: 'UML' }, storage);

      await diagramNotationHandler.applyToCanvas({ canvas_id: 'canvas-1', notation: n1.notation }, storage);
      await diagramNotationHandler.applyToCanvas({ canvas_id: 'canvas-2', notation: n2.notation }, storage);

      const assoc1 = await storage.get('canvas-notation', 'canvas-1');
      const assoc2 = await storage.get('canvas-notation', 'canvas-2');
      expect(assoc1!.notation_id).toBe(n1.notation);
      expect(assoc2!.notation_id).toBe(n2.notation);
    });
  });
});
