// @migrated dsl-constructs 2026-03-18
// ============================================================
// CanvasEntity Handler (Score Layer)
//
// Queryable representation of a canvas and its spatial contents.
// Links items, connectors, ports, notation, and layout data
// for Score navigation and debugging. Enables queries like
// "what items are on canvas X", "what connectors exist between
// A and B", "what notation is active".
//
// Uses imperative style because updateStats needs dynamic storage
// keys derived from find results.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

let idCounter = 0;
function nextId(): string {
  return `canvas-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvasId = input.canvas_id as string;
    const name = input.name as string;

    const existing = await storage.find('canvas-entity', { canvas_id: canvasId });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `clef/canvas/${name}`;

    await storage.put('canvas-entity', id, {
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

    return { variant: 'ok', id, symbol };
  },

  async updateStats(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvasId = input.canvas_id as string;

    const entities = await storage.find('canvas-entity', { canvas_id: canvasId });
    if (entities.length === 0) {
      return { variant: 'notfound', message: `Canvas entity for '${canvasId}' not found` };
    }

    const entity = entities[0];
    const id = entity.id as string;

    // Merge input stats into existing record
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
  },

  async getCanvas(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvasId = input.canvas_id as string;

    const entities = await storage.find('canvas-entity', { canvas_id: canvasId });
    if (entities.length === 0) {
      return { variant: 'notfound', message: `Canvas entity for '${canvasId}' not found` };
    }

    return { variant: 'ok', entity: entities[0] };
  },

  async listCanvases(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const all = await storage.find('canvas-entity', {});
    return {
      variant: 'ok',
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
  },

  async getConnectorGraph(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvasId = input.canvas_id as string;

    const connectors = await storage.find('canvas-connector-entity', { canvas_id: canvasId });
    return {
      variant: 'ok',
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
  },
};

export const canvasEntityHandler = _handler;

/** Reset the ID counter. Useful for testing. */
export function resetCanvasEntityCounter(): void {
  idCounter = 0;
}

export default canvasEntityHandler;
