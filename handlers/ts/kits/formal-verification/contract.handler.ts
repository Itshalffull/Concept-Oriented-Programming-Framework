// @clef-handler style=imperative
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
  createProgram, get, find, put, branch, pure, merge, mapBindings, pureFrom,
  mergeFrom, putFrom,
  type StorageProgram,
  complete,
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
      return complete(createProgram(), 'invalid', { message: 'name, source_concept, and target_concept are required' }) as StorageProgram<Result>;
    }

    let assumptionsList: string[];
    let guaranteesList: string[];
    try {
      assumptionsList = JSON.parse(assumptions);
      guaranteesList = JSON.parse(guarantees);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'assumptions and guarantees must be valid JSON arrays' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(assumptionsList) || !Array.isArray(guaranteesList)) {
      return complete(createProgram(), 'invalid', { message: 'assumptions and guarantees must be arrays' }) as StorageProgram<Result>;
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

    return complete(p, 'ok', { id, name, source_concept, target_concept,
      compatibility_status: 'unchecked' }) as StorageProgram<Result>;
  },

  verify(input) {
    const id = input.id as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'contract');
    p = branch(
      p,
      (bindings) => bindings.contract == null,
      complete(createProgram(), 'notfound', { id }),
      (() => {
        // Derive verification status from contract guarantees
        let inner = createProgram();
        inner = mapBindings(inner, (bindings) => {
          const contract = bindings.contract as Record<string, unknown>;
          const guarantees: string[] = JSON.parse(contract.guarantees as string);
          const missingGuarantees = guarantees.filter(g => g === '');
          const status = missingGuarantees.length > 0 ? 'incompatible' : 'compatible';
          return { status, missing_guarantees: missingGuarantees };
        }, 'verification');
        inner = mergeFrom(inner, RELATION, id, (bindings) => {
          const v = bindings.verification as { status: string };
          return { compatibility_status: v.status, updated_at: now };
        });
        return pureFrom(inner, (bindings) => {
          const contract = bindings.contract as Record<string, unknown>;
          const v = bindings.verification as { status: string; missing_guarantees: string[] };
          const assumptions: string[] = JSON.parse(contract.assumptions as string);
          const guarantees: string[] = JSON.parse(contract.guarantees as string);
          return {
            variant: 'ok', id,
            compatibility_status: v.status,
            missing_guarantees: JSON.stringify(v.missing_guarantees),
            assumption_count: assumptions.length,
            guarantee_count: guarantees.length,
          };
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
      return complete(createProgram(), 'invalid', { message: 'contract_ids must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(ids) || ids.length < 2) {
      return complete(createProgram(), 'invalid', { message: 'At least two contracts are required for composition' }) as StorageProgram<Result>;
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
      complete(createProgram(), 'notfound', { message: 'One or more contracts not found' }),
      (() => {
        const composedId = `ct-composed-${simpleHash(ids.join(':'))}`;
        const now = new Date().toISOString();

        let inner = createProgram();

        // Derive composed contract fields from all fetched contracts
        inner = mapBindings(inner, (bindings) => {
          const allAssumptions: string[] = [];
          const allGuarantees: string[] = [];
          let firstSource = '';
          let lastTarget = '';

          for (let i = 0; i < ids.length; i++) {
            const contract = bindings[`contract_${i}`] as Record<string, unknown>;
            const assumptions: string[] = JSON.parse(contract.assumptions as string);
            const guarantees: string[] = JSON.parse(contract.guarantees as string);
            allAssumptions.push(...assumptions);
            allGuarantees.push(...guarantees);
            if (i === 0) firstSource = contract.source_concept as string;
            if (i === ids.length - 1) lastTarget = contract.target_concept as string;
          }

          // Discharged = assumptions that appear in any contract's guarantees
          const guaranteeSet = new Set(allGuarantees);
          const discharged = allAssumptions.filter(a => guaranteeSet.has(a));
          const dischargedSet = new Set(discharged);
          const remaining = allAssumptions.filter(a => !dischargedSet.has(a));

          return {
            name: `composed:${ids.join('+')}`,
            source_concept: firstSource,
            target_concept: lastTarget,
            assumptions: remaining,
            guarantees: allGuarantees,
            discharged_assumptions: discharged,
          };
        }, 'composed');

        inner = putFrom(inner, RELATION, composedId, (bindings) => {
          const c = bindings.composed as {
            name: string;
            source_concept: string;
            target_concept: string;
            assumptions: string[];
            guarantees: string[];
            discharged_assumptions: string[];
          };
          return {
            id: composedId,
            name: c.name,
            source_concept: c.source_concept,
            target_concept: c.target_concept,
            assumptions: JSON.stringify(c.assumptions),
            guarantees: JSON.stringify(c.guarantees),
            discharged_assumptions: JSON.stringify(c.discharged_assumptions),
            compatibility_status: 'unchecked',
            composition_chain: JSON.stringify(ids),
            created_at: now,
            updated_at: now,
          };
        });

        return pureFrom(inner, (bindings) => {
          const c = bindings.composed as {
            name: string;
            source_concept: string;
            target_concept: string;
            assumptions: string[];
            guarantees: string[];
            discharged_assumptions: string[];
          };
          return {
            variant: 'ok',
            id: composedId,
            name: c.name,
            source_concept: c.source_concept,
            target_concept: c.target_concept,
            assumptions: JSON.stringify(c.assumptions),
            guarantees: JSON.stringify(c.guarantees),
            discharged_assumptions: JSON.stringify(c.discharged_assumptions),
            remaining_assumptions: JSON.stringify(c.assumptions),
            discharged_count: c.discharged_assumptions.length,
            total_guarantees: c.guarantees.length,
            composition_chain: JSON.stringify(ids),
          };
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
      complete(createProgram(), 'notfound', { id }),
      (() => {
        // Check assumption exists and is not already discharged
        return branch(
          createProgram(),
          (bindings) => {
            const contract = bindings.contract as Record<string, unknown>;
            const assumptions: string[] = JSON.parse(contract.assumptions as string);
            return !assumptions.includes(assumption_ref);
          },
          complete(createProgram(), 'invalid', { message: `Assumption "${assumption_ref}" not found in contract` }),
          (() => {
            return branch(
              createProgram(),
              (bindings) => {
                const contract = bindings.contract as Record<string, unknown>;
                const discharged: string[] = JSON.parse(contract.discharged_assumptions as string);
                return discharged.includes(assumption_ref);
              },
              complete(createProgram(), 'already_discharged', { id, assumption_ref }),
              (() => {
                let inner = createProgram();

                // Compute the updated discharged list and remaining count
                inner = mapBindings(inner, (bindings) => {
                  const contract = bindings.contract as Record<string, unknown>;
                  const discharged: string[] = JSON.parse(contract.discharged_assumptions as string);
                  const updated = [...discharged, assumption_ref];
                  const assumptions: string[] = JSON.parse(contract.assumptions as string);
                  const updatedSet = new Set(updated);
                  const remaining = assumptions.filter(a => !updatedSet.has(a)).length;
                  return {
                    discharged_assumptions: JSON.stringify(updated),
                    remaining_count: remaining,
                  };
                }, 'discharge_info');

                inner = mergeFrom(inner, RELATION, id, (bindings) => {
                  const info = bindings.discharge_info as { discharged_assumptions: string };
                  return { discharged_assumptions: info.discharged_assumptions, updated_at: now };
                });

                return pureFrom(inner, (bindings) => {
                  const info = bindings.discharge_info as {
                    discharged_assumptions: string;
                    remaining_count: number;
                  };
                  return {
                    variant: 'ok',
                    id,
                    discharged_assumption: assumption_ref,
                    remaining_count: info.remaining_count,
                    discharged_assumptions: info.discharged_assumptions,
                  };
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
    return pureFrom(p, (bindings) => {
      const items = (bindings.items as Record<string, unknown>[]) || [];
      const projected = items.map(item => ({
        id: item.id,
        name: item.name,
        source_concept: item.source_concept,
        target_concept: item.target_concept,
        compatibility_status: item.compatibility_status,
      }));
      return {
        variant: 'ok',
        count: projected.length,
        items: JSON.stringify(projected),
      };
    }) as StorageProgram<Result>;
  },
};
