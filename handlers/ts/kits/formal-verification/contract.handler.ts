// Contract Concept Implementation — Formal Verification Suite
// Define, verify, compose, and discharge assume-guarantee contracts
// between concepts, enabling modular compositional verification.
// See Architecture doc Section 18.2
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

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

export const contractHandler: ConceptHandler = {
  async define(input, storage) {
    const name = input.name as string;
    const source_concept = input.source_concept as string;
    const target_concept = input.target_concept as string;
    const assumptions = input.assumptions as string;   // JSON array of property refs
    const guarantees = input.guarantees as string;     // JSON array of property refs

    if (!name || !source_concept || !target_concept) {
      return { variant: 'invalid', message: 'name, source_concept, and target_concept are required' };
    }

    let assumptionsList: string[];
    let guaranteesList: string[];
    try {
      assumptionsList = JSON.parse(assumptions);
      guaranteesList = JSON.parse(guarantees);
    } catch {
      return { variant: 'invalid', message: 'assumptions and guarantees must be valid JSON arrays' };
    }

    if (!Array.isArray(assumptionsList) || !Array.isArray(guaranteesList)) {
      return { variant: 'invalid', message: 'assumptions and guarantees must be arrays' };
    }

    const id = `ct-${simpleHash(name + ':' + source_concept + ':' + target_concept)}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
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

    return {
      variant: 'ok',
      id,
      name,
      source_concept,
      target_concept,
      compatibility_status: 'unchecked',
    };
  },

  async verify(input, storage) {
    const id = input.id as string;

    const contract = await storage.get(RELATION, id);
    if (!contract) {
      return { variant: 'notfound', id };
    }

    const guaranteesList: string[] = JSON.parse(contract.guarantees as string);
    const assumptionsList: string[] = JSON.parse(contract.assumptions as string);

    // Mock verification: check that all guarantees exist and can satisfy assumptions.
    // In a real implementation, this would verify formal entailment relations.
    const missingGuarantees: string[] = [];
    for (const g of guaranteesList) {
      // Simulate a check: guarantee references should be non-empty
      if (!g || g.trim() === '') {
        missingGuarantees.push(g);
      }
    }

    const compatible = missingGuarantees.length === 0;
    const status = compatible ? 'compatible' : 'incompatible';
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      ...contract,
      compatibility_status: status,
      updated_at: now,
    });

    return {
      variant: 'ok',
      id,
      compatibility_status: status,
      assumption_count: assumptionsList.length,
      guarantee_count: guaranteesList.length,
      missing_guarantees: JSON.stringify(missingGuarantees),
    };
  },

  async compose(input, storage) {
    const contract_ids = input.contract_ids as string;  // JSON array of contract IDs

    let ids: string[];
    try {
      ids = JSON.parse(contract_ids);
    } catch {
      return { variant: 'invalid', message: 'contract_ids must be a valid JSON array' };
    }

    if (!Array.isArray(ids) || ids.length < 2) {
      return { variant: 'invalid', message: 'At least two contracts are required for composition' };
    }

    // Load all contracts
    const contracts: Array<Record<string, unknown>> = [];
    for (const cid of ids) {
      const c = await storage.get(RELATION, cid);
      if (!c) {
        return { variant: 'notfound', id: cid, message: `Contract "${cid}" not found` };
      }
      contracts.push(c);
    }

    // Chain contracts: discharge assumptions of contract[i+1] using guarantees of contract[i]
    const allAssumptions: string[] = [];
    const allGuarantees: string[] = [];
    const dischargedInComposition: string[] = [];

    for (let i = 0; i < contracts.length; i++) {
      const assumptions: string[] = JSON.parse(contracts[i].assumptions as string);
      const guarantees: string[] = JSON.parse(contracts[i].guarantees as string);

      allGuarantees.push(...guarantees);

      if (i === 0) {
        // First contract: all assumptions are external
        allAssumptions.push(...assumptions);
      } else {
        // Subsequent contracts: try to discharge assumptions with accumulated guarantees
        for (const assumption of assumptions) {
          if (allGuarantees.includes(assumption)) {
            dischargedInComposition.push(assumption);
          } else {
            allAssumptions.push(assumption);
          }
        }
      }
    }

    const composedId = `ct-composed-${simpleHash(ids.join(':'))}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, composedId, {
      id: composedId,
      name: `Composed(${ids.join(', ')})`,
      source_concept: contracts[0].source_concept as string,
      target_concept: contracts[contracts.length - 1].target_concept as string,
      assumptions: JSON.stringify(allAssumptions),
      guarantees: JSON.stringify(allGuarantees),
      discharged_assumptions: JSON.stringify(dischargedInComposition),
      compatibility_status: 'unchecked',
      composition_chain: JSON.stringify(ids),
      created_at: now,
      updated_at: now,
    });

    return {
      variant: 'ok',
      id: composedId,
      remaining_assumptions: JSON.stringify(allAssumptions),
      total_guarantees: allGuarantees.length,
      discharged_count: dischargedInComposition.length,
      composition_chain: JSON.stringify(ids),
    };
  },

  async discharge(input, storage) {
    const id = input.id as string;
    const assumption_ref = input.assumption_ref as string;

    const contract = await storage.get(RELATION, id);
    if (!contract) {
      return { variant: 'notfound', id };
    }

    const assumptions: string[] = JSON.parse(contract.assumptions as string);
    const discharged: string[] = JSON.parse(contract.discharged_assumptions as string);

    if (!assumptions.includes(assumption_ref)) {
      return { variant: 'invalid', message: `Assumption "${assumption_ref}" not found in contract` };
    }

    if (discharged.includes(assumption_ref)) {
      return { variant: 'already_discharged', id, assumption_ref };
    }

    discharged.push(assumption_ref);
    const remaining = assumptions.filter(a => !discharged.includes(a));
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      ...contract,
      discharged_assumptions: JSON.stringify(discharged),
      updated_at: now,
    });

    return {
      variant: 'ok',
      id,
      discharged_assumption: assumption_ref,
      remaining_undischarged: JSON.stringify(remaining),
      remaining_count: remaining.length,
    };
  },

  async list(input, storage) {
    const source_concept = input.source_concept as string | undefined;
    const target_concept = input.target_concept as string | undefined;

    let all = await storage.find(RELATION);

    if (source_concept) {
      all = all.filter((c: any) => c.source_concept === source_concept);
    }
    if (target_concept) {
      all = all.filter((c: any) => c.target_concept === target_concept);
    }

    const items = all.map((c: any) => ({
      id: c.id,
      name: c.name,
      source_concept: c.source_concept,
      target_concept: c.target_concept,
      compatibility_status: c.compatibility_status,
    }));

    return { variant: 'ok', items: JSON.stringify(items), count: items.length };
  },
};
