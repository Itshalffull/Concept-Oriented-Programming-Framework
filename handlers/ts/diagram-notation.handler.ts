// @migrated dsl-constructs 2026-03-18
// ============================================================
// DiagramNotation Handler
//
// Diagram type vocabularies with node types, edge types,
// connection rules, and visual encoding as swappable notations.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const description = (input.description as string | undefined) ?? null;

    let p = createProgram();
    p = find(p, 'diagram-notation', {}, 'all');

    return branch(p,
      (bindings) => (bindings.all as Record<string, unknown>[]).some((n) => n.name === name),
      (thenP) => complete(thenP, 'error', { message: `Notation '${name}' already exists` }),
      (elseP) => {
        const id = nextId();
        elseP = put(elseP, 'diagram-notation', id, {
          id,
          notation: id,
          name,
          description,
          node_types: [],
          edge_types: [],
          connection_rules: [],
          preferred_layout: null,
        });
        return complete(elseP, 'ok', { notation: id });
      },
    ) as StorageProgram<Result>;
  },

  addNodeType(input: Record<string, unknown>) {
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => {
        const type_key = input.type_key as string;

        return completeFrom(thenP, 'dynamic', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const nodeTypes = (record.node_types as NodeType[]) ?? [];

          if (nodeTypes.some(t => t.type_key === type_key)) {
            return { variant: 'duplicate', message: `Node type '${type_key}' already exists` };
          }

          return { variant: 'ok', notation: notationId, type_key, _addNodeType: true, _record: record };
        });
      },
      (elseP) => complete(elseP, 'error', { message: `Notation '${notationId}' not found` }),
    ) as StorageProgram<Result>;
  },

  addEdgeType(input: Record<string, unknown>) {
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => {
        const type_key = input.type_key as string;

        return completeFrom(thenP, 'dynamic', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const edgeTypes = (record.edge_types as EdgeType[]) ?? [];

          if (edgeTypes.some(t => t.type_key === type_key)) {
            return { variant: 'duplicate', message: `Edge type '${type_key}' already exists` };
          }

          return { variant: 'ok', notation: notationId, type_key };
        });
      },
      (elseP) => complete(elseP, 'error', { message: `Notation '${notationId}' not found` }),
    ) as StorageProgram<Result>;
  },

  addConnectionRule(input: Record<string, unknown>) {
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => {
        const source_type = input.source_type as string;
        const target_type = input.target_type as string;
        const allowed_edge_types = input.allowed_edge_types as string[];

        return completeFrom(thenP, 'dynamic', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const nodeTypes = (record.node_types as NodeType[]) ?? [];
          const edgeTypes = (record.edge_types as EdgeType[]) ?? [];
          const nodeKeys = new Set(nodeTypes.map(t => t.type_key));
          const edgeKeys = new Set(edgeTypes.map(t => t.type_key));

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

          return { variant: 'ok', notation: notationId };
        });
      },
      (elseP) => complete(elseP, 'error', { message: `Notation '${notationId}' not found` }),
    ) as StorageProgram<Result>;
  },

  validateDiagram(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { canvas_id: canvasId }),
      (elseP) => complete(elseP, 'violations', {
        canvas_id: canvasId,
        errors: [{ element_id: canvasId, rule: 'notation_exists', message: 'Notation not found', severity: 'error' }],
      }),
    ) as StorageProgram<Result>;
  },

  getNodePalette(input: Record<string, unknown>) {
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const nodeTypes = (record.node_types as NodeType[]) ?? [];
        return {
          types: nodeTypes.map(t => ({
            type_key: t.type_key,
            label: t.label,
            shape: t.shape,
            default_fill: t.default_fill,
            icon: t.icon,
          })),
        };
      }),
      (elseP) => complete(elseP, 'ok', { types: [] }),
    ) as StorageProgram<Result>;
  },

  getEdgePalette(input: Record<string, unknown>) {
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const edgeTypes = (record.edge_types as EdgeType[]) ?? [];
        return {
          types: edgeTypes.map(t => ({
            type_key: t.type_key,
            label: t.label,
            line_style: t.line_style,
            arrow_type: t.arrow_type,
            default_color: t.default_color,
          })),
        };
      }),
      (elseP) => complete(elseP, 'ok', { types: [] }),
    ) as StorageProgram<Result>;
  },

  applyToCanvas(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const notationId = input.notation as string;

    let p = createProgram();
    p = get(p, 'diagram-notation', notationId, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = put(thenP, 'canvas-notation', canvasId, {
          canvas_id: canvasId,
          notation_id: notationId,
        });
        return complete(thenP, 'ok', { canvas_id: canvasId, notation: notationId });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Notation '${notationId}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const diagramNotationHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetDiagramNotationCounter(): void {
  idCounter = 0;
}

export default diagramNotationHandler;
