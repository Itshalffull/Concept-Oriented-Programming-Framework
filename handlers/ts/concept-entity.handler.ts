// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptEntity Handler
//
// Queryable representation of a parsed concept, linking its
// declaration to generated artifacts and runtime behavior. Enables
// semantic queries like "what syncs participate in this concept?"
// and "what artifacts were generated from it?"
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `concept-entity-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    let p = createProgram();
    p = find(p, 'concept-entity', { name }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>[];
        return { existing: existing[0].id as string };
      }),
      (elseP) => {
        const id = nextId();
        const symbol = `clef/concept/${name}`;

        let purposeText = '';
        let version = 0;
        let gate = 'false';
        let capabilitiesList = '[]';
        let typeParams = '[]';
        let actionsRef = '[]';
        let actionsDetailRef = '[]';
        let stateFieldsRef = '[]';
        let stateFieldsDetailRef = '[]';
        let suite = '';

        try {
          const parsed = JSON.parse(ast);
          purposeText = parsed.purpose || '';
          version = parsed.version || 0;
          gate = parsed.annotations?.gate ? 'true' : 'false';
          capabilitiesList = JSON.stringify(parsed.capabilities || []);
          typeParams = JSON.stringify(parsed.typeParams || []);
          actionsRef = JSON.stringify((parsed.actions || []).map((a: Record<string, unknown>) => a.name));
          actionsDetailRef = JSON.stringify((parsed.actions || []).map((a: Record<string, unknown>) => ({
            name: a.name,
            variants: ((a.variants || []) as Array<Record<string, unknown>>).map(v => v.name),
            params: ((a.params || []) as Array<Record<string, unknown>>).map(p => p.name),
          })));
          stateFieldsRef = JSON.stringify((parsed.state || []).map((s: Record<string, unknown>) => s.name));
          stateFieldsDetailRef = JSON.stringify((parsed.state || []).map((s: Record<string, unknown>) => ({
            name: s.name,
            type: typeof s.type === 'object' ? (s.type as Record<string, unknown>).kind || 'unknown' : String(s.type || 'unknown'),
            cardinality: typeof s.type === 'object' ? ((s.type as Record<string, unknown>).kind === 'set' ? 'set' :
              (s.type as Record<string, unknown>).kind === 'list' ? 'list' :
              (s.type as Record<string, unknown>).kind === 'option' ? 'option' :
              (s.type as Record<string, unknown>).kind === 'relation' ? 'relation' : 'one') : 'one',
          })));
          suite = parsed.suite || '';
        } catch {
          // AST may be empty or non-JSON; store defaults
        }

        elseP = put(elseP, 'concept-entity', id, {
          id,
          name,
          symbol,
          sourceFile: source,
          purposeText,
          version,
          gate,
          capabilitiesList,
          typeParams,
          actionsRef,
          actionsDetailRef,
          stateFieldsRef,
          stateFieldsDetailRef,
          suite,
        });

        return complete(elseP, 'ok', { entity: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'concept-entity', { name }, 'results');

    return branch(p,
      (bindings) => (bindings.results as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', {}),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const results = bindings.results as Record<string, unknown>[];
        return { entity: results[0].id as string };
      }),
    ) as StorageProgram<Result>;
  },

  findByCapability(input: Record<string, unknown>) {
    const capability = input.capability as string;

    let p = createProgram();
    p = find(p, 'concept-entity', {}, 'allEntities');

    return completeFrom(p, 'ok', (bindings) => {
      const allEntities = bindings.allEntities as Record<string, unknown>[];
      const matching = allEntities.filter((e) => {
        try {
          const caps = JSON.parse(e.capabilitiesList as string || '[]');
          return Array.isArray(caps) && caps.includes(capability);
        } catch {
          return false;
        }
      });
      return { entities: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findBySuite(input: Record<string, unknown>) {
    const suite = input.suite as string;

    let p = createProgram();
    p = find(p, 'concept-entity', { suite }, 'results');

    return completeFrom(p, 'ok', (bindings) => ({
      entities: JSON.stringify(bindings.results),
    })) as StorageProgram<Result>;
  },

  generatedArtifacts(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = get(p, 'concept-entity', entity, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          // Would need to find provenance records, returning empty for non-iterative
          return { artifacts: '[]' };
        });
      },
      (elseP) => complete(elseP, 'ok', { artifacts: '[]' }),
    ) as StorageProgram<Result>;
  },

  participatingSyncs(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = get(p, 'concept-entity', entity, 'record');
    p = find(p, 'sync-entity', {}, 'allSyncs');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const conceptName = record.name as string;
          const allSyncs = bindings.allSyncs as Record<string, unknown>[];

          const matching = allSyncs.filter((s) => {
            try {
              const compiled = JSON.parse(s.compiled as string || '{}');
              const whenRefs = (compiled.when || []).some(
                (w: Record<string, unknown>) => w.concept === conceptName,
              );
              const thenRefs = (compiled.then || []).some(
                (t: Record<string, unknown>) => t.concept === conceptName,
              );
              return whenRefs || thenRefs;
            } catch {
              return false;
            }
          });

          return { syncs: JSON.stringify(matching) };
        });
      },
      (elseP) => complete(elseP, 'ok', { syncs: '[]' }),
    ) as StorageProgram<Result>;
  },

  checkCompatibility(input: Record<string, unknown>) {
    const a = input.a as string;
    const b = input.b as string;

    let p = createProgram();
    p = get(p, 'concept-entity', a, 'recordA');
    p = get(p, 'concept-entity', b, 'recordB');

    return branch(p,
      (bindings) => !bindings.recordA || !bindings.recordB,
      (thenP) => complete(thenP, 'incompatible', { reason: 'One or both concept entities not found' }),
      (elseP) => {
        return completeFrom(elseP, 'dynamic', (bindings) => {
          const recordA = bindings.recordA as Record<string, unknown>;
          const recordB = bindings.recordB as Record<string, unknown>;

          try {
            const typeParamsA = JSON.parse(recordA.typeParams as string || '[]') as string[];
            const typeParamsB = JSON.parse(recordB.typeParams as string || '[]') as string[];

            const shared = typeParamsA.filter((tp: string) => typeParamsB.includes(tp));

            if (shared.length > 0) {
              return { variant: 'compatible', sharedTypeParams: JSON.stringify(shared) };
            }

            const capsA = JSON.parse(recordA.capabilitiesList as string || '[]') as string[];
            const capsB = JSON.parse(recordB.capabilitiesList as string || '[]') as string[];

            const conflicts = capsA.filter((c: string) => capsB.includes(c) && c.startsWith('exclusive-'));
            if (conflicts.length > 0) {
              return {
                variant: 'incompatible',
                reason: `Conflicting exclusive capabilities: ${JSON.stringify(conflicts)}`,
              };
            }

            return { variant: 'compatible', sharedTypeParams: '[]' };
          } catch {
            return { variant: 'incompatible', reason: 'Failed to parse type parameters' };
          }
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const conceptEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConceptEntityCounter(): void {
  idCounter = 0;
}
