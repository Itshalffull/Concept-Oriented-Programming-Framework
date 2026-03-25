// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// ============================================================
// CanvasEntity Handler (Score Layer)
//
// Queryable representation of a canvas and its spatial contents.
// Links items, connectors, ports, notation, and layout data
// for Score navigation and debugging. Enables queries like
// "what items are on canvas X", "what connectors exist between
// A and B", "what notation is active".
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  putFrom, mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

let idCounter = 0;
function nextId(): string {
  return `canvas-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (b) => completeFrom(b, 'alreadyRegistered', (bindings) => ({
        existing: ((bindings.existing as Record<string, unknown>[])[0].id as string),
      })) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        const symbol = `clef/canvas/${name}`;

        let b2 = put(b, 'canvas-entity', id, {
          id,
          canvas_id: canvasId,
          name,
          symbol,
          item_count: 0,
          connector_count: 0,
          local_item_count: 0,
          referenced_item_count: 0,
          local_connector_count: 0,
          semantic_connector_count: 0,
          surfaced_connector_count: 0,
          notation_id: null,
          notation_name: null,
          frame_count: 0,
          group_count: 0,
        });

        return complete(b2, 'ok', { id, symbol }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  // updateStats needs imperative override — dynamic storage key from find results
  updateStats(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
  },

  getCanvas(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'entities');

    return branch(p,
      (b) => (b.entities as unknown[]).length === 0,
      (b) => complete(b, 'notfound', { message: `Canvas entity for '${canvasId}' not found` }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => ({
        entity: (bindings.entities as Record<string, unknown>[])[0],
      })) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  listCanvases(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'canvas-entity', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => ({
      canvases: (bindings.all as Record<string, unknown>[]).map((e) => ({
        id: e.id,
        canvas_id: e.canvas_id,
        name: e.name,
        symbol: e.symbol,
        item_count: e.item_count,
        connector_count: e.connector_count,
        notation_name: e.notation_name,
      })),
    })) as StorageProgram<Result>;
  },

  getConnectorGraph(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', { canvas_id: canvasId }, 'connectors');
    return completeFrom(p, 'ok', (bindings) => ({
      canvas_id: canvasId,
      edges: (bindings.connectors as Record<string, unknown>[]).map((c) => ({
        id: c.id,
        source: c.source_item,
        target: c.target_item,
        kind: c.kind,
        label: c.label,
        type_key: c.type_key,
      })),
    })) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

// Imperative override for updateStats — dynamic storage key from find results
const _updateStats: ConceptHandler['updateStats'] = async (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => {
  const canvasId = input.canvas_id as string;
  const entities = await storage.find('canvas-entity', { canvas_id: canvasId });
  if (entities.length === 0) {
    return { variant: 'notfound', message: `Canvas entity for '${canvasId}' not found` };
  }
  const entity = entities[0];
  const id = entity.id as string;
  const updates: Record<string, unknown> = { ...entity };
  if (input.item_count !== undefined) updates.item_count = input.item_count;
  if (input.connector_count !== undefined) updates.connector_count = input.connector_count;
  if (input.local_item_count !== undefined) updates.local_item_count = input.local_item_count;
  if (input.referenced_item_count !== undefined) updates.referenced_item_count = input.referenced_item_count;
  if (input.local_connector_count !== undefined) updates.local_connector_count = input.local_connector_count;
  if (input.semantic_connector_count !== undefined) updates.semantic_connector_count = input.semantic_connector_count;
  if (input.surfaced_connector_count !== undefined) updates.surfaced_connector_count = input.surfaced_connector_count;
  if (input.notation_id !== undefined) updates.notation_id = input.notation_id;
  if (input.notation_name !== undefined) updates.notation_name = input.notation_name;
  if (input.frame_count !== undefined) updates.frame_count = input.frame_count;
  if (input.group_count !== undefined) updates.group_count = input.group_count;
  await storage.put('canvas-entity', id, updates);
  return { variant: 'ok', canvas_id: canvasId };
};

export const canvasEntityHandler: FunctionalConceptHandler & ConceptHandler = {
  ..._base,
  updateStats: _updateStats,
} as FunctionalConceptHandler & ConceptHandler;

/** Reset the ID counter. Useful for testing. */
export function resetCanvasEntityCounter(): void {
  idCounter = 0;
}

export default canvasEntityHandler;
