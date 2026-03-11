// ============================================================
// ConnectorEntity Handler (Score Layer)
//
// Queryable representation of canvas connectors as typed edges
// in the Score graph. Tracks connector kind (local/semantic/
// surfaced), source/target items, port attachments, notation
// type, and visual style. Enables queries like "find all semantic
// connectors" or "trace connections between items".
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `connector-entity-${++idCounter}`;
}

export const connectorEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const connectorId = input.connector_id as string;
    const canvasId = input.canvas_id as string;

    const existing = await storage.find('canvas-connector-entity', { connector_id: connectorId });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `clef/canvas/${canvasId}/connector/${connectorId}`;

    await storage.put('canvas-connector-entity', id, {
      id,
      connector_id: connectorId,
      canvas_id: canvasId,
      symbol,
      source_item: input.source_item as string,
      target_item: input.target_item as string,
      kind: (input.kind as string) ?? 'local',
      label: (input.label as string | undefined) ?? null,
      type_key: (input.type_key as string | undefined) ?? null,
      source_port: (input.source_port as string | undefined) ?? null,
      target_port: (input.target_port as string | undefined) ?? null,
      reference_id: (input.reference_id as string | undefined) ?? null,
    });

    return { variant: 'ok', id, symbol };
  },

  async updateKind(input: Record<string, unknown>, storage: ConceptStorage) {
    const connectorId = input.connector_id as string;
    const kind = input.kind as string;

    const entities = await storage.find('canvas-connector-entity', { connector_id: connectorId });
    if (entities.length === 0) {
      return { variant: 'notfound', message: `Connector entity for '${connectorId}' not found` };
    }

    await storage.put('canvas-connector-entity', entities[0].id as string, {
      ...entities[0],
      kind,
      reference_id: (input.reference_id as string | undefined) ?? entities[0].reference_id,
    });

    return { variant: 'ok', connector_id: connectorId, kind };
  },

  async listByCanvas(input: Record<string, unknown>, storage: ConceptStorage) {
    const canvasId = input.canvas_id as string;
    const connectors = await storage.find('canvas-connector-entity', { canvas_id: canvasId });
    return {
      variant: 'ok',
      connectors: connectors.map((c: Record<string, unknown>) => ({
        id: c.id,
        connector_id: c.connector_id,
        source_item: c.source_item,
        target_item: c.target_item,
        kind: c.kind,
        label: c.label,
        type_key: c.type_key,
      })),
    };
  },

  async listByKind(input: Record<string, unknown>, storage: ConceptStorage) {
    const kind = input.kind as string;
    const canvasId = (input.canvas_id as string | undefined);

    let connectors = await storage.find('canvas-connector-entity', { kind });
    if (canvasId) {
      connectors = connectors.filter((c: Record<string, unknown>) => c.canvas_id === canvasId);
    }

    return {
      variant: 'ok',
      connectors: connectors.map((c: Record<string, unknown>) => ({
        id: c.id,
        connector_id: c.connector_id,
        canvas_id: c.canvas_id,
        source_item: c.source_item,
        target_item: c.target_item,
        kind: c.kind,
        label: c.label,
      })),
    };
  },

  async getConnectionsBetween(input: Record<string, unknown>, storage: ConceptStorage) {
    const itemA = input.item_a as string;
    const itemB = input.item_b as string;

    const all = await storage.list('canvas-connector-entity');
    const connections = all.filter((c: Record<string, unknown>) =>
      (c.source_item === itemA && c.target_item === itemB) ||
      (c.source_item === itemB && c.target_item === itemA)
    );

    return {
      variant: 'ok',
      connections: connections.map((c: Record<string, unknown>) => ({
        id: c.id,
        connector_id: c.connector_id,
        canvas_id: c.canvas_id,
        source_item: c.source_item,
        target_item: c.target_item,
        kind: c.kind,
        label: c.label,
      })),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConnectorEntityCounter(): void {
  idCounter = 0;
}

export default connectorEntityHandler;
