// ============================================================
// FormalProperty Handler — Formal Verification Suite
//
// Define, prove, refute, check, synthesize, report coverage,
// list with filters, and invalidate formal properties.
// See Architecture doc Section 18.1
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';

const VALID_KINDS = ['invariant', 'precondition', 'postcondition', 'temporal', 'safety', 'liveness'];
const VALID_LANGUAGES = ['smtlib', 'tlaplus', 'alloy', 'lean', 'dafny', 'cvl'];
const VALID_SCOPES = ['local', 'global'];
const VALID_PRIORITIES = ['required', 'optional', 'recommended'];

const COLLECTION = 'formal-properties';

export const formalPropertyHandler: ConceptHandler = {
  async define(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const kind = input.kind as string;
    const formal_language = input.formal_language as string;
    const expression = input.expression as string;
    const target_symbol = input.target_symbol as string;
    const scope = input.scope as string;
    const priority = input.priority as string;

    if (!VALID_KINDS.includes(kind)) {
      return {
        variant: 'invalid',
        message: `Invalid kind: ${kind}. Must be one of: ${VALID_KINDS.join(', ')}`,
      };
    }

    if (!VALID_LANGUAGES.includes(formal_language)) {
      return {
        variant: 'invalid',
        message: `Invalid formal_language: ${formal_language}. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
      };
    }

    if (!VALID_SCOPES.includes(scope)) {
      return {
        variant: 'invalid',
        message: `Invalid scope: ${scope}. Must be one of: ${VALID_SCOPES.join(', ')}`,
      };
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return {
        variant: 'invalid',
        message: `Invalid priority: ${priority}. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      };
    }

    const id = `fp-${randomUUID()}`;
    const created_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      id,
      name,
      kind,
      formal_language,
      expression,
      target_symbol,
      scope,
      priority,
      status: 'unproven',
      created_at,
    });

    return {
      variant: 'ok',
      id,
      name,
      kind,
      status: 'unproven',
    };
  },

  async prove(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;
    const evidence_ref = input.evidence_ref as string;

    const prop = await storage.get(COLLECTION, id);
    if (!prop) {
      return { variant: 'notfound', id };
    }

    await storage.put(COLLECTION, id, {
      ...prop,
      status: 'proved',
      evidence_ref,
      proved_at: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      id,
      status: 'proved',
      evidence_ref,
    };
  },

  async refute(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;
    const evidence_ref = input.evidence_ref as string;

    const prop = await storage.get(COLLECTION, id);
    if (!prop) {
      return { variant: 'notfound', id };
    }

    await storage.put(COLLECTION, id, {
      ...prop,
      status: 'refuted',
      evidence_ref,
      refuted_at: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      id,
      status: 'refuted',
      evidence_ref,
    };
  },

  async check(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;
    const solver = (input.solver as string) || 'mock';

    const prop = await storage.get(COLLECTION, id);
    if (!prop) {
      return { variant: 'notfound', id };
    }

    // Simulate solver dispatch — deterministic mock result
    const possibleResults = ['proved', 'refuted', 'unknown'];
    const hash = (prop.expression as string).length % 3;
    const check_result = possibleResults[hash];

    return {
      variant: 'ok',
      id,
      current_status: prop.status,
      check_result,
      solver,
    };
  },

  async synthesize(input: Record<string, unknown>, storage: ConceptStorage) {
    const intent_ref = input.intent_ref as string;
    const target_symbol = input.target_symbol as string;
    const formal_language = (input.formal_language as string) || 'smtlib';

    // Synthesize 3 properties: invariant, precondition, postcondition
    const kinds = ['invariant', 'precondition', 'postcondition'];
    const property_ids: string[] = [];

    for (const kind of kinds) {
      const id = `fp-${randomUUID()}`;
      const created_at = new Date().toISOString();

      await storage.put(COLLECTION, id, {
        id,
        name: `${intent_ref}-${kind}`,
        kind,
        formal_language,
        expression: `(synthesized-${kind} from ${intent_ref})`,
        target_symbol,
        scope: 'local',
        priority: 'required',
        status: 'unproven',
        intent_ref,
        created_at,
      });

      property_ids.push(id);
    }

    return {
      variant: 'ok',
      intent_ref,
      count: property_ids.length,
      property_ids: JSON.stringify(property_ids),
    };
  },

  async coverage(input: Record<string, unknown>, storage: ConceptStorage) {
    const target_symbol = input.target_symbol as string;

    const all = await storage.find(COLLECTION, { target_symbol });

    const total = all.length;
    const proved = all.filter(p => p.status === 'proved').length;
    const refuted = all.filter(p => p.status === 'refuted').length;
    const unproven = all.filter(p => p.status === 'unproven').length;
    const coverage_pct = total === 0 ? 0 : proved / total;

    return {
      variant: 'ok',
      target_symbol,
      total,
      proved,
      refuted,
      unproven,
      coverage_pct,
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const target_symbol = input.target_symbol as string | undefined;
    const kind = input.kind as string | undefined;
    const status = input.status as string | undefined;

    let all = await storage.find(COLLECTION);

    if (target_symbol) {
      all = all.filter(p => p.target_symbol === target_symbol);
    }
    if (kind) {
      all = all.filter(p => p.kind === kind);
    }
    if (status) {
      all = all.filter(p => p.status === status);
    }

    return {
      variant: 'ok',
      count: all.length,
      items: JSON.stringify(
        all.map(p => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          target_symbol: p.target_symbol,
          status: p.status,
          formal_language: p.formal_language,
        })),
      ),
    };
  },

  async invalidate(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const prop = await storage.get(COLLECTION, id);
    if (!prop) {
      return { variant: 'notfound', id };
    }

    const previous_status = prop.status as string;

    if (previous_status === 'unproven') {
      return {
        variant: 'unchanged',
        id,
        status: 'unproven',
      };
    }

    await storage.put(COLLECTION, id, {
      ...prop,
      status: 'unproven',
      evidence_ref: undefined,
      proved_at: undefined,
      refuted_at: undefined,
      invalidated_at: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      id,
      previous_status,
      status: 'unproven',
    };
  },
};
