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
    let p = createProgram();
    const canvasId = input.canvas_id as string;
    const name = input.name as string;

    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'existing');
    if (existing.length > 0) {
      return complete(p, 'alreadyRegistered', { existing: existing[0].id as string }) as StorageProgram<Result>;
    }

    const id = nextId();
    const symbol = `clef/canvas/${name}`;

    p = put(p, 'canvas-entity', id, {
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

    return complete(p, 'ok', { id, symbol }) as StorageProgram<Result>;
  },

  updateStats(input: Record<string, unknown>) {
    let p = createProgram();
    const canvasId = input.canvas_id as string;

    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'entities');
    if (entities.length === 0) {
      return complete(p, 'notfound', { message: `Canvas entity for '${canvasId}' not found` }) as StorageProgram<Result>;
    }

    const entity = entities[0];
    p = put(p, 'canvas-entity', entity.id as string, {
      ...entity,
      item_count: (input.item_count as number) ?? entity.item_count,
      connector_count: (input.connector_count as number) ?? entity.connector_count,
      local_item_count: (input.local_item_count as number) ?? entity.local_item_count,
      referenced_item_count: (input.referenced_item_count as number) ?? entity.referenced_item_count,
      local_connector_count: (input.local_connector_count as number) ?? entity.local_connector_count,
      semantic_connector_count: (input.semantic_connector_count as number) ?? entity.semantic_connector_count,
      surfaced_connector_count: (input.surfaced_connector_count as number) ?? entity.surfaced_connector_count,
      notation_id: (input.notation_id as string) ?? entity.notation_id,
      notation_name: (input.notation_name as string) ?? entity.notation_name,
      frame_count: (input.frame_count as number) ?? entity.frame_count,
      group_count: (input.group_count as number) ?? entity.group_count,
    });

    return complete(p, 'ok', { canvas_id: canvasId }) as StorageProgram<Result>;
  },

  getCanvas(input: Record<string, unknown>) {
    let p = createProgram();
    const canvasId = input.canvas_id as string;
    p = find(p, 'canvas-entity', { canvas_id: canvasId }, 'entities');
    if (entities.length === 0) {
      return complete(p, 'notfound', { message: `Canvas entity for '${canvasId}' not found` }) as StorageProgram<Result>;
    }
    return complete(p, 'ok', { entity: entities[0] }) as StorageProgram<Result>;
  },

  listCanvases(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'canvas-entity', {}, 'all');
    return complete(p, 'ok', {
      canvases: all.map((e: Record<string, unknown>) => ({
        id: e.id,
        canvas_id: e.canvas_id,
        name: e.name,
        symbol: e.symbol,
        item_count: e.item_count,
        connector_count: e.connector_count,
        notation_name: e.notation_name,
      })),
    }) as StorageProgram<Result>;
  },

  getConnectorGraph(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    // Return connector relationship data for Score graph queries
    p = find(p, 'canvas-connector-entity', { canvas_id: canvasId }, 'connectors');
    return complete(p, 'ok', {
      canvas_id: canvasId,
      edges: connectors.map((c: Record<string, unknown>) => ({
        id: c.id,
        source: c.source_item,
        target: c.target_item,
        kind: c.kind,
        label: c.label,
        type_key: c.type_key,
      })),
    }) as StorageProgram<Result>;
  },
};

export const canvasEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetCanvasEntityCounter(): void {
  idCounter = 0;
}

export default canvasEntityHandler;
