// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConnectorEntity Handler (Score Layer)
//
// Queryable representation of canvas connectors as typed edges
// in the Score graph. Tracks connector kind (local/semantic/
// surfaced), source/target items, port attachments, notation
// type, and visual style. Enables queries like "find all semantic
// connectors" or "trace connections between items".
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `connector-entity-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    let p = createProgram();
    const connectorId = input.connector_id as string;
    const canvasId = input.canvas_id as string;

    p = find(p, 'canvas-connector-entity', { connector_id: connectorId }, 'existing');
    if (existing.length > 0) {
      return complete(p, 'alreadyRegistered', { existing: existing[0].id as string }) as StorageProgram<Result>;
    }

    const id = nextId();
    const symbol = `clef/canvas/${canvasId}/connector/${connectorId}`;

    p = put(p, 'canvas-connector-entity', id, {
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

    return complete(p, 'ok', { id, symbol }) as StorageProgram<Result>;
  },

  updateKind(input: Record<string, unknown>) {
    let p = createProgram();
    const connectorId = input.connector_id as string;
    const kind = input.kind as string;

    p = find(p, 'canvas-connector-entity', { connector_id: connectorId }, 'entities');
    if (entities.length === 0) {
      return complete(p, 'notfound', { message: `Connector entity for '${connectorId}' not found` }) as StorageProgram<Result>;
    }

    p = put(p, 'canvas-connector-entity', entities[0].id as string, {
      ...entities[0],
      kind,
      reference_id: (input.reference_id as string | undefined) ?? entities[0].reference_id,
    });

    return complete(p, 'ok', { connector_id: connectorId, kind }) as StorageProgram<Result>;
  },

  listByCanvas(input: Record<string, unknown>) {
    let p = createProgram();
    const canvasId = input.canvas_id as string;
    p = find(p, 'canvas-connector-entity', { canvas_id: canvasId }, 'connectors');
    return complete(p, 'ok', {
      connectors: connectors.map((c: Record<string, unknown>) => ({
        id: c.id,
        connector_id: c.connector_id,
        source_item: c.source_item,
        target_item: c.target_item,
        kind: c.kind,
        label: c.label,
        type_key: c.type_key,
      })),
    }) as StorageProgram<Result>;
  },

  listByKind(input: Record<string, unknown>) {
    let p = createProgram();
    const kind = input.kind as string;
    const canvasId = (input.canvas_id as string | undefined);

    p = find(p, 'canvas-connector-entity', { kind }, 'connectors');
    if (canvasId) {
      connectors = connectors.filter((c: Record<string, unknown>) => c.canvas_id === canvasId);
    }

    return complete(p, 'ok', {
      connectors: connectors.map((c: Record<string, unknown>) => ({
        id: c.id,
        connector_id: c.connector_id,
        canvas_id: c.canvas_id,
        source_item: c.source_item,
        target_item: c.target_item,
        kind: c.kind,
        label: c.label,
      })),
    }) as StorageProgram<Result>;
  },

  getConnectionsBetween(input: Record<string, unknown>) {
    let p = createProgram();
    const itemA = input.item_a as string;
    const itemB = input.item_b as string;

    p = find(p, 'canvas-connector-entity', {}, 'all');
    const connections = all.filter((c: Record<string, unknown>) =>
      (c.source_item === itemA && c.target_item === itemB) ||
      (c.source_item === itemB && c.target_item === itemA)
    );

    return complete(p, 'ok', {
      connections: connections.map((c: Record<string, unknown>) => ({
        id: c.id,
        connector_id: c.connector_id,
        canvas_id: c.canvas_id,
        source_item: c.source_item,
        target_item: c.target_item,
        kind: c.kind,
        label: c.label,
      })),
    }) as StorageProgram<Result>;
  },
};

export const connectorEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConnectorEntityCounter(): void {
  idCounter = 0;
}

export default connectorEntityHandler;
