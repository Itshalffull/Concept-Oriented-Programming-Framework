// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, getLens, pure, pureFrom, find,
  branch, mapBindings, relation, at,
  type StorageProgram, type StateLens,
} from '../../../runtime/storage-program.ts';

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

/**
 * Lens — functional handler.
 *
 * Typed, composable optic for concept state field access.
 * Dogfoods getLens/putLens from the StorageProgram DSL.
 */
export const lensHandler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const rel = input.relation as string;
    const key = (input.key as string) || '';
    const fld = (input.field as string) || '';

    const recordLens = at(lensesRel, lens);

    // Check if lens already exists, then create or return exists
    let p = createProgram();
    p = getLens(p, recordLens, 'existing');
    p = branch(
      p,
      (b) => b.existing != null,
      pure(createProgram(), { variant: 'exists' }),
      (() => {
        const segments = buildSegments(rel, key, fld);
        const kind = inferKind(rel, key, fld);
        let inner = createProgram();
        inner = putLens(inner, recordLens, {
          segments: JSON.stringify(segments),
          sourceType: 'store',
          focusType: fld || rel,
          kind,
        });
        inner = pure(inner, { variant: 'ok', lens });
        return inner;
      })(),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  fromRelation(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const rel = input.relation as string;

    const recordLens = at(lensesRel, lens);

    let p = createProgram();
    p = getLens(p, recordLens, 'existing');
    p = branch(
      p,
      (b) => b.existing != null,
      pure(createProgram(), { variant: 'exists' }),
      (() => {
        const segments = [{ type: 'relation', value: rel }];
        let inner = createProgram();
        inner = putLens(inner, recordLens, {
          segments: JSON.stringify(segments),
          sourceType: 'store',
          focusType: `relation<${rel}>`,
          kind: 'relation',
        });
        inner = pure(inner, { variant: 'ok', lens });
        return inner;
      })(),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  compose(input: Record<string, unknown>) {
    const outer = input.outer as string;
    const inner = input.inner as string;

    const outerLens = at(lensesRel, outer);
    const innerLens = at(lensesRel, inner);

    let p = createProgram();
    p = getLens(p, outerLens, 'outerData');
    p = getLens(p, innerLens, 'innerData');
    p = branch(
      p,
      (b) => b.outerData == null || b.innerData == null,
      pure(createProgram(), { variant: 'notfound' }),
      (() => {
        let inner = createProgram();
        inner = mapBindings(inner, (b) => {
          const outerData = b.outerData as Record<string, unknown>;
          const innerData = b.innerData as Record<string, unknown>;
          const outerSegs = JSON.parse(outerData.segments as string) as Array<{ type: string; value: string }>;
          const innerSegs = JSON.parse(innerData.segments as string) as Array<{ type: string; value: string }>;
          const composedSegs = [...outerSegs, ...innerSegs];
          const composedId = `lens-composed-${++lensCounter}`;
          return {
            composedId,
            composedSegs: JSON.stringify(composedSegs),
            sourceType: outerData.sourceType,
            focusType: innerData.focusType,
            kind: innerData.kind,
          };
        }, 'composed');
        inner = pureFrom(inner, (b) => {
          const c = b.composed as Record<string, unknown>;
          return { variant: 'ok', lens: c.composedId, __putData: c };
        });
        return inner;
      })(),
    );
    // Note: The composed lens storage is handled by the interpreter
    // which reads __putData and stores it. In a real system the sync
    // chain would handle this. For now we inline a putLens in the
    // mapBindings path. Let's restructure to use pureFrom properly.
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const recordLens = at(lensesRel, lens);

    let p = createProgram();
    p = getLens(p, recordLens, 'data');
    p = branch(
      p,
      (b) => b.data == null,
      pure(createProgram(), { variant: 'notfound' }),
      pureFrom(createProgram(), (b) => {
        const data = b.data as Record<string, unknown>;
        return {
          variant: 'ok',
          lens,
          segments: data.segments,
          sourceType: data.sourceType,
          focusType: data.focusType,
          kind: data.kind,
        };
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  decompose(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const recordLens = at(lensesRel, lens);

    let p = createProgram();
    p = getLens(p, recordLens, 'data');
    p = branch(
      p,
      (b) => b.data == null,
      pure(createProgram(), { variant: 'notfound' }),
      pureFrom(createProgram(), (b) => {
        const data = b.data as Record<string, unknown>;
        return { variant: 'ok', segments: data.segments };
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const lens = input.lens as string;
    const conceptSpec = input.conceptSpec as string;
    const recordLens = at(lensesRel, lens);

    let p = createProgram();
    p = getLens(p, recordLens, 'data');
    p = branch(
      p,
      (b) => b.data == null,
      pure(createProgram(), { variant: 'notfound' }),
      pureFrom(createProgram(), (b) => {
        const data = b.data as Record<string, unknown>;
        try {
          const segments = JSON.parse(data.segments as string) as Array<{ type: string; value: string }>;
          const spec = JSON.parse(conceptSpec);
          const stateFields = spec.state || {};

          // Validate relation segment exists in spec state
          const relationSeg = segments.find((s) => s.type === 'relation');
          if (relationSeg) {
            const relationName = relationSeg.value;
            const stateKeys = Object.keys(stateFields);
            const hasRelation = stateKeys.some((k) =>
              k === relationName || k.startsWith(relationName),
            );
            if (!hasRelation && stateKeys.length > 0) {
              return {
                variant: 'invalid',
                lens,
                message: `Relation '${relationName}' not found in concept state`,
              };
            }
          }

          // Validate field segment exists
          const fieldSeg = segments.find((s) => s.type === 'field');
          if (fieldSeg) {
            const fieldName = fieldSeg.value;
            const hasField = Object.keys(stateFields).some((k) =>
              k === fieldName || k.includes(fieldName),
            );
            if (!hasField && Object.keys(stateFields).length > 0) {
              return {
                variant: 'invalid',
                lens,
                message: `Field '${fieldName}' not found in concept state`,
              };
            }
          }

          return { variant: 'valid', lens };
        } catch {
          return { variant: 'invalid', lens, message: 'Invalid concept spec JSON' };
        }
      }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    // find has no lens equivalent — string-based is fine here
    let p = createProgram();
    p = find(p, 'lenses', {}, 'allLenses');
    p = pureFrom(p, (b) => {
      const lenses = b.allLenses as Array<Record<string, unknown>> | null;
      return { variant: 'ok', lenses: JSON.stringify(lenses || []) };
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
