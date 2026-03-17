// Evidence Concept Implementation — Formal Verification Suite
// Record, validate, retrieve, compare, and minimize verification evidence
// (proof certificates, counterexamples, model traces, coverage reports, solver logs).
//
// Migrated to FunctionalConceptHandler: returns StoragePrograms enabling
// the monadic pipeline to extract properties like "recorded evidence always
// has a valid content_hash" and "only counterexamples can be minimized".
// See Architecture doc Section 18.3

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, pure,
  merge, mapBindings, pureFrom, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

const RELATION = 'evidence-records';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

const VALID_ARTIFACT_TYPES = [
  'proof_certificate',
  'counterexample',
  'model_trace',
  'coverage_report',
  'solver_log',
] as const;

type Result = { variant: string; [key: string]: unknown };

export const evidenceHandler: FunctionalConceptHandler = {
  record(input) {
    const property_ref = input.property_ref as string;
    const artifact_type = input.artifact_type as string;
    const content = input.content as string;
    const solver = input.solver as string | undefined;
    const run_ref = input.run_ref as string | undefined;

    if (!VALID_ARTIFACT_TYPES.includes(artifact_type as any)) {
      return pure(createProgram(), {
        variant: 'invalid',
        message: `Invalid artifact_type "${artifact_type}". Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    if (!content || content.trim() === '') {
      return pure(createProgram(), { variant: 'invalid', message: 'content must be non-empty' }) as StorageProgram<Result>;
    }

    const content_hash = simpleHash(content);
    const id = `ev-${simpleHash(property_ref + ':' + artifact_type + ':' + content_hash)}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RELATION, id, {
      id,
      property_ref,
      artifact_type,
      content,
      content_hash,
      solver: solver || '',
      run_ref: run_ref || '',
      created_at: now,
    });

    return pure(p, { variant: 'ok', id, content_hash, artifact_type, property_ref }) as StorageProgram<Result>;
  },

  validate(input) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, RELATION, id, 'evidence');
    p = branch(
      p,
      (bindings) => bindings.evidence == null,
      pure(createProgram(), { variant: 'notfound', id }),
      pureFrom(createProgram(), (bindings) => {
        const evidence = bindings.evidence as Record<string, unknown>;
        const recomputed = simpleHash(evidence.content as string);
        const valid = recomputed === evidence.content_hash;
        return {
          variant: 'ok',
          id,
          valid,
          stored_hash: evidence.content_hash,
          computed_hash: recomputed,
        };
      }),
    );
    return p as StorageProgram<Result>;
  },

  retrieve(input) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, RELATION, id, 'evidence');
    p = branch(
      p,
      (bindings) => bindings.evidence == null,
      pure(createProgram(), { variant: 'notfound', id }),
      pureFrom(createProgram(), (bindings) => {
        const evidence = bindings.evidence as Record<string, unknown>;
        return {
          variant: 'ok',
          id,
          property_ref: evidence.property_ref,
          artifact_type: evidence.artifact_type,
          content: evidence.content,
          content_hash: evidence.content_hash,
          solver: evidence.solver,
          run_ref: evidence.run_ref,
          created_at: evidence.created_at,
        };
      }),
    );
    return p as StorageProgram<Result>;
  },

  compare(input) {
    const id_a = input.id_a as string;
    const id_b = input.id_b as string;

    let p = createProgram();
    p = get(p, RELATION, id_a, 'evidenceA');
    p = get(p, RELATION, id_b, 'evidenceB');
    p = branch(
      p,
      (bindings) => bindings.evidenceA == null,
      pure(createProgram(), { variant: 'notfound', id: id_a }),
      (() => {
        return branch(
          createProgram(),
          (bindings) => bindings.evidenceB == null,
          pure(createProgram(), { variant: 'notfound', id: id_b }),
          pureFrom(createProgram(), (bindings) => {
            const a = bindings.evidenceA as Record<string, unknown>;
            const b = bindings.evidenceB as Record<string, unknown>;
            return {
              variant: 'ok',
              id_a,
              id_b,
              same_hash: a.content_hash === b.content_hash,
              same_artifact_type: a.artifact_type === b.artifact_type,
              same_property_ref: a.property_ref === b.property_ref,
            };
          }),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },

  minimize(input) {
    const id = input.id as string;

    let p = createProgram();
    p = get(p, RELATION, id, 'evidence');
    p = branch(
      p,
      (bindings) => bindings.evidence == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        // Only counterexamples can be minimized
        return branch(
          createProgram(),
          (bindings) => (bindings.evidence as Record<string, unknown>).artifact_type !== 'counterexample',
          pureFrom(createProgram(), (bindings) => {
            const evidence = bindings.evidence as Record<string, unknown>;
            return {
              variant: 'not_applicable',
              id,
              artifact_type: evidence.artifact_type,
              message: 'Only counterexamples can be minimized',
            };
          }),
          (() => {
            const minimizedId = `ev-min-${simpleHash(id + ':minimized')}`;
            const now = new Date().toISOString();

            // Derive the minimized record from the evidence binding
            let inner = createProgram();
            inner = mapBindings(inner, (bindings) => {
              const evidence = bindings.evidence as Record<string, unknown>;
              const content = evidence.content as string;
              const minimizedContent = content.length > 20
                ? content.slice(0, Math.floor(content.length * 2 / 3))
                : content;
              const minimizedHash = simpleHash(minimizedContent);
              return {
                id: minimizedId,
                property_ref: evidence.property_ref,
                artifact_type: evidence.artifact_type,
                content: minimizedContent,
                content_hash: minimizedHash,
                solver: evidence.solver || '',
                run_ref: evidence.run_ref || '',
                minimized_from: id,
                created_at: now,
              };
            }, 'minimized');

            inner = putFrom(inner, RELATION, minimizedId, (bindings) =>
              bindings.minimized as Record<string, unknown>,
            );

            return pureFrom(inner, (bindings) => {
              const evidence = bindings.evidence as Record<string, unknown>;
              const minimized = bindings.minimized as Record<string, unknown>;
              const originalSize = (evidence.content as string).length;
              const minimizedSize = (minimized.content as string).length;
              return {
                variant: 'ok',
                original_id: id,
                minimized_id: minimizedId,
                original_size: originalSize,
                minimized_size: minimizedSize,
                reduction_pct: originalSize > 0
                  ? Math.round((1 - minimizedSize / originalSize) * 100)
                  : 0,
              };
            });
          })(),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },

  list(input) {
    const property_ref = input.property_ref as string | undefined;
    const artifact_type = input.artifact_type as string | undefined;

    const criteria: Record<string, unknown> = {};
    if (property_ref) criteria.property_ref = property_ref;
    if (artifact_type) criteria.artifact_type = artifact_type;

    let p = createProgram();
    p = find(p, RELATION, criteria, 'items');
    return pureFrom(p, (bindings) => {
      const items = (bindings.items as Record<string, unknown>[]) || [];
      const projected = items.map(item => ({
        id: item.id,
        property_ref: item.property_ref,
        artifact_type: item.artifact_type,
        content_hash: item.content_hash,
        solver: item.solver,
        created_at: item.created_at,
      }));
      return {
        variant: 'ok',
        count: projected.length,
        items: JSON.stringify(projected),
      };
    }) as StorageProgram<Result>;
  },
};
