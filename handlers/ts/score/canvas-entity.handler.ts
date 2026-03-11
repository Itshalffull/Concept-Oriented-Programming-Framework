// ============================================================
// CanvasEntity Handler (Score Layer)
//
// Queryable representation of a canvas and its spatial contents.
// Links items, connectors, ports, notation, and layout data
// for Score navigation and debugging. Enables queries like
// "what items are on canvas X", "what connectors exist between
// A and B", "what notation is active".
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `canvas-entity-${++idCounter}`;
}

export const canvasEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
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

  async updateStats(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;

    const entities = await storage.find('canvas-entity', { canvas_id: canvasId });
    if (entities.length === 0) {
      return { variant: 'notfound', message: `Canvas entity for '${canvasId}' not found` };
    }

    const entity = entities[0];
    await storage.put('canvas-entity', entity.id as string, {
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

    return { variant: 'ok', canvas_id: canvasId };
  },

  async getCanvas(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const entities = await storage.find('canvas-entity', { canvas_id: canvasId });
    if (entities.length === 0) {
      return { variant: 'notfound', message: `Canvas entity for '${canvasId}' not found` };
    }
    return { variant: 'ok', entity: entities[0] };
  },

  async listCanvases(_input: Record<string, unknown>, storage: ConceptStorage) {
    const all = await storage.list('canvas-entity');
    return {
      variant: 'ok',
      canvases: all.map((e: Record<string, unknown>) => ({
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

  async getConnectorGraph(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;

    // Return connector relationship data for Score graph queries
    const connectors = await storage.find('canvas-connector-entity', { canvas_id: canvasId });
    return {
      variant: 'ok',
      canvas_id: canvasId,
      edges: connectors.map((c: Record<string, unknown>) => ({
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

/** Reset the ID counter. Useful for testing. */
export function resetCanvasEntityCounter(): void {
  idCounter = 0;
}

export default canvasEntityHandler;
