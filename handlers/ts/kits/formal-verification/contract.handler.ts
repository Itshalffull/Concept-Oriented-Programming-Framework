// Contract Concept Implementation — Formal Verification Suite
// Define, verify, compose, and discharge assume-guarantee contracts
// between concepts, enabling modular compositional verification.
//
// Migrated to FunctionalConceptHandler: returns StoragePrograms enabling
// the monadic pipeline to extract properties like "composed contracts
// discharge internal assumptions" and "verify always updates
// compatibility_status".
// See Architecture doc Section 18.2

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

const RELATION = 'contracts';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

type Result = { variant: string; [key: string]: unknown };

export const contractHandler: FunctionalConceptHandler = {
  define(input) {
    const name = input.name as string;
    const source_concept = input.source_concept as string;
    const target_concept = input.target_concept as string;
    const assumptions = input.assumptions as string;
    const guarantees = input.guarantees as string;

    if (!name || !source_concept || !target_concept) {
      return pure(createProgram(), { variant: 'invalid', message: 'name, source_concept, and target_concept are required' }) as StorageProgram<Result>;
    }

    let assumptionsList: string[];
    let guaranteesList: string[];
    try {
      assumptionsList = JSON.parse(assumptions);
      guaranteesList = JSON.parse(guarantees);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'assumptions and guarantees must be valid JSON arrays' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(assumptionsList) || !Array.isArray(guaranteesList)) {
      return pure(createProgram(), { variant: 'invalid', message: 'assumptions and guarantees must be arrays' }) as StorageProgram<Result>;
    }

    const id = `ct-${simpleHash(name + ':' + source_concept + ':' + target_concept)}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RELATION, id, {
      id,
      name,
      source_concept,
      target_concept,
      assumptions: JSON.stringify(assumptionsList),
      guarantees: JSON.stringify(guaranteesList),
      discharged_assumptions: JSON.stringify([]),
      compatibility_status: 'unchecked',
      composition_chain: JSON.stringify([]),
      created_at: now,
      updated_at: now,
    });

    return pure(p, {
      variant: 'ok', id, name, source_concept, target_concept,
      compatibility_status: 'unchecked',
    }) as StorageProgram<Result>;
  },

  verify(input) {
    const id = input.id as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'contract');
    p = branch(
      p,
      (bindings) => bindings.contract == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        // Verify: check guarantees are non-empty. Real impl checks formal entailment.
        let inner = createProgram();
        inner = put(inner, RELATION, id, {
          __merge: true,
          __compute: 'verify_compatibility',
          updated_at: now,
        });
        return pure(inner, {
          variant: 'ok',
          id,
          __compute: 'verify_result',
        });
      })(),
    );
    return p as StorageProgram<Result>;
  },

  compose(input) {
    const contract_ids = input.contract_ids as string;

    let ids: string[];
    try {
      ids = JSON.parse(contract_ids);
    } catch {
      return pure(createProgram(), { variant: 'invalid', message: 'contract_ids must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(ids) || ids.length < 2) {
      return pure(createProgram(), { variant: 'invalid', message: 'At least two contracts are required for composition' }) as StorageProgram<Result>;
    }

    // Read all contracts
    let p = createProgram();
    for (let i = 0; i < ids.length; i++) {
      p = get(p, RELATION, ids[i], `contract_${i}`);
    }

    // Branch: check all exist
    p = branch(
      p,
      (bindings) => {
        for (let i = 0; i < ids.length; i++) {
          if (bindings[`contract_${i}`] == null) return true;
        }
        return false;
      },
      pure(createProgram(), { variant: 'notfound', message: 'One or more contracts not found' }),
      (() => {
        const composedId = `ct-composed-${simpleHash(ids.join(':'))}`;
        const now = new Date().toISOString();

        let inner = createProgram();
        inner = put(inner, RELATION, composedId, {
          id: composedId,
          __compute: 'compose_contracts',
          __contract_ids: JSON.stringify(ids),
          composition_chain: JSON.stringify(ids),
          compatibility_status: 'unchecked',
          created_at: now,
          updated_at: now,
        });
        return pure(inner, {
          variant: 'ok',
          id: composedId,
          __compute: 'compose_result',
          composition_chain: JSON.stringify(ids),
        });
      })(),
    );
    return p as StorageProgram<Result>;
  },

  discharge(input) {
    const id = input.id as string;
    const assumption_ref = input.assumption_ref as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'contract');
    p = branch(
      p,
      (bindings) => bindings.contract == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        // Check assumption exists and not already discharged
        return branch(
          createProgram(),
          (bindings) => {
            const contract = bindings.contract as Record<string, unknown>;
            const assumptions: string[] = JSON.parse(contract.assumptions as string);
            return !assumptions.includes(assumption_ref);
          },
          pure(createProgram(), { variant: 'invalid', message: `Assumption "${assumption_ref}" not found in contract` }),
          (() => {
            return branch(
              createProgram(),
              (bindings) => {
                const contract = bindings.contract as Record<string, unknown>;
                const discharged: string[] = JSON.parse(contract.discharged_assumptions as string);
                return discharged.includes(assumption_ref);
              },
              pure(createProgram(), { variant: 'already_discharged', id, assumption_ref }),
              (() => {
                let inner = createProgram();
                inner = put(inner, RELATION, id, {
                  __merge: true,
                  __compute: 'discharge_assumption',
                  __assumption_ref: assumption_ref,
                  updated_at: now,
                });
                return pure(inner, {
                  variant: 'ok',
                  id,
                  discharged_assumption: assumption_ref,
                  __compute: 'discharge_result',
                });
              })(),
            );
          })(),
        );
      })(),
    );
    return p as StorageProgram<Result>;
  },

  list(input) {
    const source_concept = input.source_concept as string | undefined;
    const target_concept = input.target_concept as string | undefined;

    const criteria: Record<string, unknown> = {};
    if (source_concept) criteria.source_concept = source_concept;
    if (target_concept) criteria.target_concept = target_concept;

    let p = createProgram();
    p = find(p, RELATION, criteria, 'items');
    return pure(p, {
      variant: 'ok',
      __compute: 'list',
      __fields: ['id', 'name', 'source_concept', 'target_concept', 'compatibility_status'],
    }) as StorageProgram<Result>;
  },
};
