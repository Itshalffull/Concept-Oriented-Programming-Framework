// ============================================================
// Contract Handler — Formal Verification Suite
//
// Assume-guarantee contract definition, verification,
// composition, assumption discharge, and listing with filters.
// See Architecture doc Section 18.2
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

const COLLECTION = 'contracts';

export const contractHandler: ConceptHandler = {
  async define(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const source_concept = input.source_concept as string;
    const target_concept = input.target_concept as string;
    const assumptions_raw = input.assumptions as string;
    const guarantees_raw = input.guarantees as string;

    if (!source_concept || !target_concept) {
      return {
        variant: 'invalid',
        message: 'source_concept and target_concept are required and must be non-empty',
      };
    }

    // Validate JSON
    let assumptions: string[];
    let guarantees: string[];
    try {
      assumptions = JSON.parse(assumptions_raw);
    } catch {
      return {
        variant: 'invalid',
        message: 'assumptions must be valid JSON array',
      };
    }
    try {
      guarantees = JSON.parse(guarantees_raw);
    } catch {
      return {
        variant: 'invalid',
        message: 'guarantees must be valid JSON array',
      };
    }

    const id = `ct-${randomUUID()}`;
    const created_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      id,
      name,
      source_concept,
      target_concept,
      assumptions: JSON.stringify(assumptions),
      guarantees: JSON.stringify(guarantees),
      discharged_assumptions: JSON.stringify([]),
      compatibility_status: 'unchecked',
      created_at,
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

  async verify(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const contract = await storage.get(COLLECTION, id);
    if (!contract) {
      return { variant: 'notfound', id };
    }

    const assumptions = JSON.parse(contract.assumptions as string) as string[];
    const guarantees = JSON.parse(contract.guarantees as string) as string[];

    // Check for empty guarantee entries (indicates incompatibility)
    const emptyGuarantees = guarantees.filter(g => !g || g.trim() === '');
    const missing_guarantees = emptyGuarantees;

    const compatibility_status = missing_guarantees.length > 0 ? 'incompatible' : 'compatible';

    await storage.put(COLLECTION, id, {
      ...contract,
      compatibility_status,
    });

    return {
      variant: 'ok',
      id,
      compatibility_status,
      assumption_count: assumptions.length,
      guarantee_count: guarantees.length,
      missing_guarantees: JSON.stringify(missing_guarantees),
    };
  },

  async compose(input: Record<string, unknown>, storage: ConceptStorage) {
    const contract_ids_raw = input.contract_ids as string;
    const contract_ids = JSON.parse(contract_ids_raw) as string[];

    if (contract_ids.length < 2) {
      return {
        variant: 'invalid',
        message: 'Composition requires at least two contracts',
      };
    }

    // Load all contracts
    const contracts = [];
    for (const cid of contract_ids) {
      const c = await storage.get(COLLECTION, cid);
      if (!c) return { variant: 'notfound', id: cid };
      contracts.push(c);
    }

    // Collect all guarantees from all contracts
    const allGuarantees = new Set<string>();
    for (const c of contracts) {
      const guarantees = JSON.parse(c.guarantees as string) as string[];
      for (const g of guarantees) {
        if (g && g.trim()) allGuarantees.add(g);
      }
    }

    // Collect all assumptions from all contracts
    const allAssumptions: string[] = [];
    for (const c of contracts) {
      const assumptions = JSON.parse(c.assumptions as string) as string[];
      for (const a of assumptions) {
        allAssumptions.push(a);
      }
    }

    // Discharge assumptions that are satisfied by guarantees
    const discharged: string[] = [];
    const remaining: string[] = [];

    for (const a of allAssumptions) {
      if (allGuarantees.has(a)) {
        discharged.push(a);
      } else {
        remaining.push(a);
      }
    }

    // Deduplicate discharged
    const uniqueDischarged = [...new Set(discharged)];

    // Collect total guarantees count
    const totalGuarantees = allGuarantees.size;

    // Create composed contract
    const id = `ct-${randomUUID()}`;
    const created_at = new Date().toISOString();

    // Remaining assumptions deduplicated for storage
    const uniqueRemaining = [...new Set(remaining)];

    await storage.put(COLLECTION, id, {
      id,
      name: `composed-${contract_ids.join('-')}`,
      source_concept: contracts[0].source_concept,
      target_concept: contracts[contracts.length - 1].target_concept,
      assumptions: JSON.stringify(uniqueRemaining),
      guarantees: JSON.stringify([...allGuarantees]),
      discharged_assumptions: JSON.stringify([]),
      compatibility_status: 'unchecked',
      composed_from: contract_ids_raw,
      created_at,
    });

    return {
      variant: 'ok',
      id,
      discharged_count: uniqueDischarged.length,
      remaining_assumptions: JSON.stringify(uniqueRemaining),
      total_guarantees: totalGuarantees,
    };
  },

  async discharge(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;
    const assumption_ref = input.assumption_ref as string;

    const contract = await storage.get(COLLECTION, id);
    if (!contract) {
      return { variant: 'notfound', id };
    }

    const assumptions = JSON.parse(contract.assumptions as string) as string[];
    const discharged = JSON.parse(contract.discharged_assumptions as string) as string[];

    // Check if assumption exists in the contract
    if (!assumptions.includes(assumption_ref) && !discharged.includes(assumption_ref)) {
      return {
        variant: 'invalid',
        message: `Assumption '${assumption_ref}' not found in contract ${id}`,
      };
    }

    // Check if already discharged
    if (discharged.includes(assumption_ref)) {
      return {
        variant: 'already_discharged',
        assumption_ref,
      };
    }

    // Discharge the assumption
    discharged.push(assumption_ref);
    const remaining = assumptions.filter(a => !discharged.includes(a));

    await storage.put(COLLECTION, id, {
      ...contract,
      discharged_assumptions: JSON.stringify(discharged),
    });

    return {
      variant: 'ok',
      id,
      discharged_assumption: assumption_ref,
      remaining_count: remaining.length,
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const source_concept = input.source_concept as string | undefined;
    const target_concept = input.target_concept as string | undefined;

    let all = await storage.find(COLLECTION);

    if (source_concept) {
      all = all.filter(c => c.source_concept === source_concept);
    }
    if (target_concept) {
      all = all.filter(c => c.target_concept === target_concept);
    }

    return {
      variant: 'ok',
      count: all.length,
      items: JSON.stringify(
        all.map(c => ({
          id: c.id,
          name: c.name,
          source_concept: c.source_concept,
          target_concept: c.target_concept,
          compatibility_status: c.compatibility_status,
        })),
      ),
    };
  },
};
