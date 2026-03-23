// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, putFrom, get, find,
  branch, mapBindings, complete, completeFrom,
  relation, at,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

// Module-scope lens constants — dogfooding the lens DSL for our own storage access.
const lensesRel = relation('lenses');

/** Infer lens kind from which segments are provided. */
function inferKind(rel: string, key: string, fld: string): string {
  if (fld) return 'field';
  if (key) return 'record';
  return 'relation';
}

/** Build segments array from relation/key/field strings. */
function buildSegments(rel: string, key: string, fld: string): Array<{ type: string; value: string }> {
  const segs: Array<{ type: string; value: string }> = [{ type: 'relation', value: rel }];
  if (key) segs.push({ type: 'key', value: key });
  if (fld) segs.push({ type: 'field', value: fld });
  return segs;
}

let lensCounter = 0;
export function resetLensCounter(): void { lensCounter = 0; }

/** Derive the storage relation name from the lenses relation lens. */
function lensRelName(): string {
  const seg = lensesRel.segments[0];
  return seg && seg.kind === 'relation' ? seg.name : 'lenses';
}

/**
 * Lens — functional handler.
 *
 * Typed, composable optic for concept state field access.
 * Uses regular get/put with the lens id as key in the 'lenses' relation.
 */
export const lensHandler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    if (!input.relation || (typeof input.relation === 'string' && (input.relation as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'relation is required' }) as StorageProgram<Result>;
    }
    const lens = input.lens as string;
    const rel = input.relation as string;
    const key = (input.key as string) || '';
    const fld = (input.field as string) || '';

    const relName = lensRelName();

    // Check if lens already exists, then create or return exists
    let p = createProgram();
    p = get(p, relName, lens, 'existing');
    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'ok', { lens }),
      (() => {
        const segments = buildSegments(rel, key, fld);
        const kind = inferKind(rel, key, fld);
        let inner = createProgram();
        inner = put(inner, relName, lens, {
          segments: JSON.stringify(segments),
          sourceType: 'store',
          focusType: fld || rel,
          kind,
        });
        return complete(inner, 'ok', { lens });
      })(),
    ) as StorageProgram<Result>;
  },

  fromRelation(input: Record<string, unknown>) {
    if (!input.relation || (typeof input.relation === 'string' && (input.relation as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'relation is required' }) as StorageProgram<Result>;
    }
    const lens = input.lens as string;
    const rel = input.relation as string;

    const relName = lensRelName();

    let p = createProgram();
    p = get(p, relName, lens, 'existing');
    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'ok', { lens }),
      (() => {
        const segments = [{ type: 'relation', value: rel }];
        let inner = createProgram();
        inner = put(inner, relName, lens, {
          segments: JSON.stringify(segments),
          sourceType: 'store',
          focusType: `relation<${rel}>`,
          kind: 'relation',
        });
        return complete(inner, 'ok', { lens });
      })(),
    ) as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const outer = input.outer as string;
    const inner = input.inner as string;

    const relName = lensRelName();

    let p = createProgram();
    p = get(p, relName, outer, 'outerData');
    p = get(p, relName, inner, 'innerData');
    // Compose requires inner to exist. outer may be a logical reference.
    return branch(p,
      (b) => b.innerData == null,
      complete(createProgram(), 'notfound', {}),
      (() => {
        let sub = createProgram();
        sub = mapBindings(sub, (b) => {
          const outerData = b.outerData as Record<string, unknown> | null;
          const innerData = b.innerData as Record<string, unknown>;
          const outerSegs: Array<{ type: string; value: string }> = outerData
            ? (JSON.parse(outerData.segments as string) as Array<{ type: string; value: string }>)
            : [{ type: 'ref', value: outer }];
          const innerSegs = JSON.parse(innerData.segments as string) as Array<{ type: string; value: string }>;
          const composedSegs = [...outerSegs, ...innerSegs];
          const composedId = `lens-composed-${++lensCounter}`;
          return {
            composedId,
            composedSegs: JSON.stringify(composedSegs),
            sourceType: outerData ? outerData.sourceType : 'store',
            focusType: innerData.focusType,
            kind: innerData.kind,
          };
        }, 'composed');
        sub = putFrom(sub, relName, 'lens-composed-latest', (b) => {
          const c = b.composed as Record<string, unknown>;
          return {
            segments: c.composedSegs,
            sourceType: c.sourceType,
            focusType: c.focusType,
            kind: c.kind,
          };
        });
        return completeFrom(sub, 'ok', (b) => {
          const c = b.composed as Record<string, unknown>;
          return { lens: c.composedId as string };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const relName = lensRelName();

    let p = createProgram();
    p = get(p, relName, lens, 'data');
    return branch(p,
      (b) => b.data == null,
      complete(createProgram(), 'notfound', {}),
      completeFrom(createProgram(), 'ok', (b) => {
        const data = b.data as Record<string, unknown>;
        return {
          lens,
          segments: data.segments,
          sourceType: data.sourceType,
          focusType: data.focusType,
          kind: data.kind,
        };
      }),
    ) as StorageProgram<Result>;
  },

  decompose(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const relName = lensRelName();

    let p = createProgram();
    p = get(p, relName, lens, 'data');
    return branch(p,
      (b) => b.data == null,
      complete(createProgram(), 'notfound', {}),
      completeFrom(createProgram(), 'ok', (b) => {
        const data = b.data as Record<string, unknown>;
        return { segments: data.segments };
      }),
    ) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    if (!input.lens || (typeof input.lens === 'string' && (input.lens as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'lens is required' }) as StorageProgram<Result>;
    }
    const lens = input.lens as string;
    const relName = lensRelName();

    let p = createProgram();
    p = get(p, relName, lens, 'data');
    return branch(p,
      (b) => b.data == null,
      complete(createProgram(), 'notfound', {}),
      complete(createProgram(), 'ok', { lens }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    const relName = lensRelName();
    let p = createProgram();
    p = find(p, relName, {}, 'allLenses');
    return completeFrom(p, 'ok', (b) => {
      const lenses = b.allLenses as Array<Record<string, unknown>> | null;
      return { lenses: JSON.stringify(lenses || []) };
    }) as StorageProgram<Result>;
  },
};
