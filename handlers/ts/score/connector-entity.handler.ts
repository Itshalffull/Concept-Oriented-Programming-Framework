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
import {
  createProgram, find, put, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
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

  /**
   * Update the kind (and optionally reference_id) of an existing connector entity.
   * Uses find + traverse to resolve the dynamic storage key functionally.
   */
  updateKind(input: Record<string, unknown>) {
    const connectorId = input.connector_id as string;
    const kind = input.kind as string;
    const referenceId = input.reference_id as string | undefined;

    let p = createProgram();
    p = find(p, 'canvas-connector-entity', { connector_id: connectorId }, 'entities');

    return branch(p,
      (bindings) => (bindings.entities as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', { message: `Connector entity for '${connectorId}' not found` }),
      (elseP) => {
        // Use traverse over the single-element find result to access the dynamic entity id
        elseP = traverse(elseP, 'entities', '_entity', (item) => {
          const entity = item as Record<string, unknown>;
          const entityId = entity.id as string;
          const updated: Record<string, unknown> = { ...entity, kind };
          if (referenceId !== undefined) {
            updated.reference_id = referenceId;
          }
          delete updated._key;

          let sub = createProgram();
          sub = put(sub, 'canvas-connector-entity', entityId, updated);
          return complete(sub, 'ok', {});
        }, '_updateResults', { writes: ['canvas-connector-entity'], completionVariants: ['ok'] });

        return complete(elseP, 'ok', { connector_id: connectorId, kind });
      },
    ) as StorageProgram<Result>;
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

// All actions are now fully functional — no imperative overrides needed.
export const connectorEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConnectorEntityCounter(): void {
  idCounter = 0;
}

export default connectorEntityHandler;
