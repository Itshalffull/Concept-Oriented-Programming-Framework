// @clef-handler style=functional
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
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, get, put, putFrom, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function drawId(canvas: string, source: string, target: string): string {
  return `connector-${canvas}-${source}-${target}`;
}

const _handler: FunctionalConceptHandler = {
  draw(input: Record<string, unknown>): StorageProgram<Result> {
    const canvas = (input.canvas as string) ?? 'canvas';
    const source = (input.source as string) ?? (input.from as string);
    const target = (input.target as string) ?? (input.to as string);
    const type = (input.type as string) ?? 'visual';
    const label = (input.label as string | undefined) ?? undefined;

    const id = drawId(canvas, source, target);
    const record = {
      id, connector: id,
      connector_canvas: canvas, connector_source: source,
      connector_target: target, connector_type: type,
      connector_label: label ?? null,
      from: source, to: target, type,
    };

    let p = createProgram();
    p = put(p, 'spatial-connector', id, record);
    p = put(p, 'connector', id, record);
    return complete(p, 'ok', { connector: id, output: { connector: id } }) as StorageProgram<Result>;
  },

  promote(input: Record<string, unknown>): StorageProgram<Result> {
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'spatial-connector', connector, 'record');

    return branch(p,
      (b) => b.record == null,
      (notFoundP) => complete(notFoundP, 'already_semantic', {
        message: `Connector '${connector}' not found or already semantic`,
      }),
      (foundP) => {
        return branch(foundP,
          (b) => {
            const rec = b.record as Record<string, unknown>;
            return rec.connector_type === 'semantic' || rec.type === 'semantic';
          },
          (alreadyP) => complete(alreadyP, 'already_semantic', {
            message: `Connector '${connector}' is already semantic`,
          }),
          (visualP) => {
            const p2 = putFrom(visualP, 'spatial-connector', connector, (b) => {
              const rec = b.record as Record<string, unknown>;
              return { ...rec, type: 'semantic', connector_type: 'semantic' };
            });
            const p3 = putFrom(p2, 'connector', connector, (b) => {
              const rec = b.record as Record<string, unknown>;
              return { ...rec, type: 'semantic', connector_type: 'semantic' };
            });
            return complete(p3, 'ok', { output: {} });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  demote(input: Record<string, unknown>): StorageProgram<Result> {
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'spatial-connector', connector, 'record');

    return branch(p,
      (b) => b.record == null,
      (notFoundP) => complete(notFoundP, 'not_semantic', {
        message: `Connector '${connector}' not found or not semantic`,
      }),
      (foundP) => {
        return branch(foundP,
          (b) => {
            const rec = b.record as Record<string, unknown>;
            return rec.connector_type === 'visual' || rec.type === 'visual';
          },
          (alreadyVisualP) => complete(alreadyVisualP, 'ok', { output: {} }),
          (semanticP) => {
            const p2 = putFrom(semanticP, 'spatial-connector', connector, (b) => {
              const rec = b.record as Record<string, unknown>;
              return { ...rec, type: 'visual', connector_type: 'visual' };
            });
            const p3 = putFrom(p2, 'connector', connector, (b) => {
              const rec = b.record as Record<string, unknown>;
              return { ...rec, type: 'visual', connector_type: 'visual' };
            });
            return complete(p3, 'ok', { output: {} });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  surface(input: Record<string, unknown>): StorageProgram<Result> {
    const canvas = (input.canvas as string) ?? 'canvas';
    const source = (input.source as string) ?? (input.from as string);
    const target = (input.target as string) ?? (input.to as string);
    const ref = (input.ref as string | undefined) ?? undefined;

    if (!ref) {
      const orphanParts = ['orphan', 'unref', 'dangling'];
      const isOrphan = orphanParts.some(p => source?.includes(p) || target?.includes(p));
      if (isOrphan) {
        return complete(createProgram(), 'no_reference', { source, target }) as StorageProgram<Result>;
      }
    }

    const id = drawId(canvas, source, target);
    const record = {
      id, connector: id,
      connector_canvas: canvas, connector_source: source,
      connector_target: target, connector_type: 'surfaced',
      connector_label: ref ?? null,
      from: source, to: target, ref, type: 'semantic',
    };

    let p = createProgram();
    p = put(p, 'spatial-connector', id, record);
    p = put(p, 'connector', id, record);
    return complete(p, 'ok', { connector: id }) as StorageProgram<Result>;
  },

  hide(input: Record<string, unknown>): StorageProgram<Result> {
    const connector = input.connector as string;

    let p = createProgram();
    p = get(p, 'spatial-connector', connector, 'record');

    return branch(p,
      (b) => b.record == null,
      (notFoundP) => complete(notFoundP, 'notFound', {
        message: `Connector '${connector}' not found`,
      }),
      (foundP) => {
        const p2 = del(foundP, 'spatial-connector', connector);
        const p3 = del(p2, 'connector', connector);
        return complete(p3, 'ok', { output: {} });
      },
    ) as StorageProgram<Result>;
  },
};

export const spatialConnectorHandler = autoInterpret(_handler);

export default spatialConnectorHandler;
