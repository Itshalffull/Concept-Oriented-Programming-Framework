// @migrated dsl-constructs 2026-03-18
// ============================================================
// SpatialConnector Handler
//
// Visual and semantic connectors between canvas elements.
// Connectors start as visual (purely presentational) and can be
// promoted to semantic (carrying meaning in the model). Existing
// references can be surfaced as connectors, and connectors can
// be hidden (deleted).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `connector-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  draw(input: Record<string, unknown>) {
    const canvas = (input.canvas as string) ?? 'canvas';
    const source = (input.source as string) ?? (input.from as string);
    const target = (input.target as string) ?? (input.to as string);
    const type = (input.type as string) ?? 'visual';
    const label = (input.label as string | undefined) ?? undefined;

    const id = nextId();
    const record = {
      id,
      connector: id,
      connector_canvas: canvas,
      connector_source: source,
      connector_target: target,
      connector_type: type,
      connector_label: label ?? null,
      from: source,
      to: target,
      type,
    };

    let p = createProgram();
    p = put(p, 'spatial-connector', id, record);
    p = put(p, 'connector', id, record);

    return complete(p, 'ok', { connector: id }) as StorageProgram<Result>;
  },

  promote(input: Record<string, unknown>) {
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'spatial-connector', connector, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.connector_type === 'semantic' || record.type === 'semantic') {
            return { variant: 'already_semantic', message: `Connector '${connector}' is already semantic` };
          }
          return {};
        });
      },
      (elseP) => complete(elseP, 'notFound', { message: `Connector '${connector}' not found` }),
    ) as StorageProgram<Result>;
  },

  demote(input: Record<string, unknown>) {
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'spatial-connector', connector, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          if (record.connector_type === 'visual' || record.type === 'visual') {
            return { variant: 'not_semantic', message: `Connector '${connector}' is not semantic` };
          }
          return {};
        });
      },
      (elseP) => complete(elseP, 'notFound', { message: `Connector '${connector}' not found` }),
    ) as StorageProgram<Result>;
  },

  surface(input: Record<string, unknown>) {
    const canvas = (input.canvas as string) ?? 'canvas';
    const source = (input.source as string) ?? (input.from as string);
    const target = (input.target as string) ?? (input.to as string);
    const ref = (input.ref as string | undefined) ?? undefined;

    const id = nextId();
    const record = {
      id,
      connector: id,
      connector_canvas: canvas,
      connector_source: source,
      connector_target: target,
      connector_type: 'surfaced',
      connector_label: ref ?? null,
      from: source,
      to: target,
      ref,
      type: 'semantic',
    };

    let p = createProgram();
    p = put(p, 'spatial-connector', id, record);
    p = put(p, 'connector', id, record);

    return complete(p, 'ok', { connector: id }) as StorageProgram<Result>;
  },

  hide(input: Record<string, unknown>) {
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'spatial-connector', connector, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, 'spatial-connector', connector);
        thenP = del(thenP, 'connector', connector);
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notFound', { message: `Connector '${connector}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const spatialConnectorHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSpatialConnectorCounter(): void {
  idCounter = 0;
}

export default spatialConnectorHandler;
