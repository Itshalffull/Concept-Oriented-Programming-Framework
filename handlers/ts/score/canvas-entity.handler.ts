// @migrated dsl-constructs 2026-03-18
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
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => ({
        existing: (bindings.existing as Record<string, unknown>[])[0].id as string,
      })),
      (elseP) => {
        const id = nextId();
        const symbol = `clef/canvas/${name}`;

        elseP = put(elseP, 'canvas-entity', id, {
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

        return complete(elseP, 'ok', { id, symbol });
      },
    ) as StorageProgram<Result>;
  },

  updateStats(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'entities');

    return branch(p,
      (bindings) => (bindings.entities as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', { message: `Canvas entity for '${canvasId}' not found` }),
      (elseP) => completeFrom(elseP, 'ok', (_bindings) => ({ canvas_id: canvasId })),
    ) as StorageProgram<Result>;
  },

  getCanvas(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'entities');

    return branch(p,
      (bindings) => (bindings.entities as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', { message: `Canvas entity for '${canvasId}' not found` }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => ({
        entity: (bindings.entities as Record<string, unknown>[])[0],
      })),
    ) as StorageProgram<Result>;
  },

  listCanvases(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'canvas-entity', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      return {
        canvases: all.map((e) => ({
          id: e.id,
          canvas_id: e.canvas_id,
          name: e.name,
          symbol: e.symbol,
          item_count: e.item_count,
          connector_count: e.connector_count,
          notation_name: e.notation_name,
        })),
      };
    }) as StorageProgram<Result>;
  },

  getConnectorGraph(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', { canvas_id: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const connectors = bindings.connectors as Record<string, unknown>[];
      return {
        canvas_id: canvasId,
        edges: connectors.map((c) => ({
          id: c.id,
          source: c.source_item,
          target: c.target_item,
          kind: c.kind,
          label: c.label,
          type_key: c.type_key,
        })),
      };
    }) as StorageProgram<Result>;
  },
};

export const canvasEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetCanvasEntityCounter(): void {
  idCounter = 0;
}

export default canvasEntityHandler;
