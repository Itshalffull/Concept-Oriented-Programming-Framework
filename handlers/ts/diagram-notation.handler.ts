// ============================================================
// DiagramNotation Handler
//
// Diagram type vocabularies with node types, edge types,
// connection rules, and visual encoding as swappable notations.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `notation-${++idCounter}`;
}

interface NodeType {
  type_key: string;
  label: string;
  shape: string;
  default_fill: string | null;
  default_stroke: string | null;
  icon: string | null;
  schema_id: string | null;
}

interface EdgeType {
  type_key: string;
  label: string;
  line_style: string;
  arrow_type: string;
  default_color: string | null;
  requires_label: boolean;
}

interface ConnectionRule {
  source_type: string;
  target_type: string;
  allowed_edge_types: string[];
  min_outgoing: number | null;
  max_outgoing: number | null;
  min_incoming: number | null;
  max_incoming: number | null;
}

export const diagramNotationHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const description = (input.description as string | undefined) ?? null;

    // Check for duplicate name
    const all = await storage.list('diagram-notation');
    if (all.some((n: Record<string, unknown>) => n.name === name)) {
      return { variant: 'error', message: `Notation '${name}' already exists` };
    }

    const id = nextId();
    await storage.put('diagram-notation', id, {
      id,
      notation: id,
      name,
      description,
      node_types: [],
      edge_types: [],
      connection_rules: [],
      preferred_layout: null,
    });

    return { variant: 'ok', notation: id };
  },

  async addNodeType(input: Record<string, unknown>, storage: ConceptStorage) {
    const notationId = input.notation as string;
    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'error', message: `Notation '${notationId}' not found` };
    }

    const type_key = input.type_key as string;
    const nodeTypes = (record.node_types as NodeType[]) ?? [];

    if (nodeTypes.some(t => t.type_key === type_key)) {
      return { variant: 'duplicate', message: `Node type '${type_key}' already exists` };
    }

    const newType: NodeType = {
      type_key,
      label: input.label as string,
      shape: input.shape as string,
      default_fill: (input.default_fill as string | undefined) ?? null,
      default_stroke: (input.default_stroke as string | undefined) ?? null,
      icon: (input.icon as string | undefined) ?? null,
      schema_id: (input.schema_id as string | undefined) ?? null,
    };

    await storage.put('diagram-notation', notationId, {
      ...record,
      node_types: [...nodeTypes, newType],
    });

    return { variant: 'ok', notation: notationId, type_key };
  },

  async addEdgeType(input: Record<string, unknown>, storage: ConceptStorage) {
    const notationId = input.notation as string;
    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'error', message: `Notation '${notationId}' not found` };
    }

    const type_key = input.type_key as string;
    const edgeTypes = (record.edge_types as EdgeType[]) ?? [];

    if (edgeTypes.some(t => t.type_key === type_key)) {
      return { variant: 'duplicate', message: `Edge type '${type_key}' already exists` };
    }

    const newType: EdgeType = {
      type_key,
      label: input.label as string,
      line_style: input.line_style as string,
      arrow_type: input.arrow_type as string,
      default_color: (input.default_color as string | undefined) ?? null,
      requires_label: (input.requires_label as boolean) ?? false,
    };

    await storage.put('diagram-notation', notationId, {
      ...record,
      edge_types: [...edgeTypes, newType],
    });

    return { variant: 'ok', notation: notationId, type_key };
  },

  async addConnectionRule(input: Record<string, unknown>, storage: ConceptStorage) {
    const notationId = input.notation as string;
    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'error', message: `Notation '${notationId}' not found` };
    }

    const source_type = input.source_type as string;
    const target_type = input.target_type as string;
    const allowed_edge_types = input.allowed_edge_types as string[];

    const nodeTypes = (record.node_types as NodeType[]) ?? [];
    const edgeTypes = (record.edge_types as EdgeType[]) ?? [];
    const nodeKeys = new Set(nodeTypes.map(t => t.type_key));
    const edgeKeys = new Set(edgeTypes.map(t => t.type_key));

    // Validate referenced type keys exist
    if (!nodeKeys.has(source_type)) {
      return { variant: 'invalid', message: `Source node type '${source_type}' does not exist` };
    }
    if (!nodeKeys.has(target_type)) {
      return { variant: 'invalid', message: `Target node type '${target_type}' does not exist` };
    }
    for (const et of allowed_edge_types) {
      if (!edgeKeys.has(et)) {
        return { variant: 'invalid', message: `Edge type '${et}' does not exist` };
      }
    }

    const rule: ConnectionRule = {
      source_type,
      target_type,
      allowed_edge_types,
      min_outgoing: (input.min_outgoing as number | undefined) ?? null,
      max_outgoing: (input.max_outgoing as number | undefined) ?? null,
      min_incoming: (input.min_incoming as number | undefined) ?? null,
      max_incoming: (input.max_incoming as number | undefined) ?? null,
    };

    const rules = (record.connection_rules as ConnectionRule[]) ?? [];
    await storage.put('diagram-notation', notationId, {
      ...record,
      connection_rules: [...rules, rule],
    });

    return { variant: 'ok', notation: notationId };
  },

  async validateDiagram(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const notationId = input.notation as string;

    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'violations', canvas_id: canvasId, errors: [{ element_id: canvasId, rule: 'notation_exists', message: 'Notation not found', severity: 'error' }] };
    }

    // Validation requires canvas items/connectors from Canvas concept storage.
    // In practice this is invoked via sync chain. Return ok for now.
    return { variant: 'ok', canvas_id: canvasId };
  },

  async getNodePalette(input: Record<string, unknown>, storage: ConceptStorage) {
    const notationId = input.notation as string;
    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'ok', types: [] };
    }

    const nodeTypes = (record.node_types as NodeType[]) ?? [];
    return {
      variant: 'ok',
      types: nodeTypes.map(t => ({
        type_key: t.type_key,
        label: t.label,
        shape: t.shape,
        default_fill: t.default_fill,
        icon: t.icon,
      })),
    };
  },

  async getEdgePalette(input: Record<string, unknown>, storage: ConceptStorage) {
    const notationId = input.notation as string;
    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'ok', types: [] };
    }

    const edgeTypes = (record.edge_types as EdgeType[]) ?? [];
    return {
      variant: 'ok',
      types: edgeTypes.map(t => ({
        type_key: t.type_key,
        label: t.label,
        line_style: t.line_style,
        arrow_type: t.arrow_type,
        default_color: t.default_color,
      })),
    };
  },

  async applyToCanvas(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const notationId = input.notation as string;

    const record = await storage.get('diagram-notation', notationId);
    if (!record) {
      return { variant: 'notfound', message: `Notation '${notationId}' not found` };
    }

    // Store the canvas-notation association
    await storage.put('canvas-notation', canvasId, {
      canvas_id: canvasId,
      notation_id: notationId,
    });

    return { variant: 'ok', canvas_id: canvasId, notation: notationId };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetDiagramNotationCounter(): void {
  idCounter = 0;
}

export default diagramNotationHandler;
