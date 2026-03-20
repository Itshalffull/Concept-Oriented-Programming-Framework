// @clef-handler style=functional
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
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';
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
    const connectorId = input.connector_id as string;
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', { connector_id: connectorId }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => ({
        existing: (bindings.existing as Record<string, unknown>[])[0].id as string,
      })),
      (elseP) => {
        const id = nextId();
        const symbol = `clef/canvas/${canvasId}/connector/${connectorId}`;

        elseP = put(elseP, 'canvas-connector-entity', id, {
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

        return complete(elseP, 'ok', { id, symbol });
      },
    ) as StorageProgram<Result>;
  },

  updateKind(input: Record<string, unknown>) {
    // Placeholder — overridden by imperative implementation below
    const p = createProgram();
    return complete(p, 'notfound', {}) as StorageProgram<Result>;
  },

  listByCanvas(input: Record<string, unknown>) {
    const canvasId = input.canvas_id as string;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', { canvas_id: canvasId }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      const connectors = bindings.connectors as Record<string, unknown>[];
      return {
        connectors: connectors.map((c) => ({
          id: c.id,
          connector_id: c.connector_id,
          source_item: c.source_item,
          target_item: c.target_item,
          kind: c.kind,
          label: c.label,
          type_key: c.type_key,
        })),
      };
    }) as StorageProgram<Result>;
  },

  listByKind(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const canvasId = input.canvas_id as string | undefined;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', { kind }, 'connectors');

    return completeFrom(p, 'ok', (bindings) => {
      let connectors = bindings.connectors as Record<string, unknown>[];
      if (canvasId) {
        connectors = connectors.filter((c) => c.canvas_id === canvasId);
      }
      return {
        connectors: connectors.map((c) => ({
          id: c.id,
          connector_id: c.connector_id,
          canvas_id: c.canvas_id,
          source_item: c.source_item,
          target_item: c.target_item,
          kind: c.kind,
          label: c.label,
        })),
      };
    }) as StorageProgram<Result>;
  },

  getConnectionsBetween(input: Record<string, unknown>) {
    const itemA = input.item_a as string;
    const itemB = input.item_b as string;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', {}, 'all');

    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Record<string, unknown>[];
      const connections = all.filter((c) =>
        (c.source_item === itemA && c.target_item === itemB) ||
        (c.source_item === itemB && c.target_item === itemA),
      );
      return {
        connections: connections.map((c) => ({
          id: c.id,
          connector_id: c.connector_id,
          canvas_id: c.canvas_id,
          source_item: c.source_item,
          target_item: c.target_item,
          kind: c.kind,
          label: c.label,
        })),
      };
    }) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

// updateKind requires a dynamic storage key (the entity's id from a find result),
// which the StorageProgram DSL does not support. Override with imperative impl.
async function _updateKind(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
  const connectorId = input.connector_id as string;
  const kind = input.kind as string;
  const referenceId = input.reference_id as string | undefined;

  const entities = await storage.find('canvas-connector-entity', { connector_id: connectorId });
  if (!entities || entities.length === 0) {
    return { variant: 'notfound', message: `Connector entity for '${connectorId}' not found` };
  }

  const entity = entities[0];
  const entityId = entity.id as string;
  const updated: Record<string, unknown> = { ...entity, kind };
  if (referenceId !== undefined) {
    updated.reference_id = referenceId;
  }
  // Remove _key from find results before writing back
  delete updated._key;
  await storage.put('canvas-connector-entity', entityId, updated);

  return { variant: 'ok', connector_id: connectorId, kind };
}

export const connectorEntityHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'updateKind') return _updateKind;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;

/** Reset the ID counter. Useful for testing. */
export function resetConnectorEntityCounter(): void {
  idCounter = 0;
}

export default connectorEntityHandler;
