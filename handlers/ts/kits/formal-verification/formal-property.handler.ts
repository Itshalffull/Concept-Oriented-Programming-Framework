// FormalProperty Concept Implementation — Formal Verification Suite
// Define, prove, refute, and track formal properties (invariants, pre/postconditions,
// temporal/safety/liveness properties) across multiple formal languages and solvers.
// See Architecture doc Section 18.1
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

const RELATION = 'formal-properties';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

const VALID_KINDS = ['invariant', 'precondition', 'postcondition', 'temporal', 'safety', 'liveness'] as const;
const VALID_LANGUAGES = ['smtlib', 'tlaplus', 'alloy', 'lean', 'dafny', 'cvl'] as const;
const VALID_SCOPES = ['local', 'global', 'sync'] as const;
const VALID_PRIORITIES = ['required', 'recommended', 'optional'] as const;

export const formalPropertyHandler: ConceptHandler = {
  async define(input, storage) {
    const name = input.name as string;
    const kind = input.kind as string;
    const formal_language = input.formal_language as string;
    const expression = input.expression as string;
    const target_symbol = input.target_symbol as string;
    const scope = input.scope as string;
    const priority = input.priority as string;

    if (!VALID_KINDS.includes(kind as any)) {
      return { variant: 'invalid', message: `Invalid kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}` };
    }
    if (!VALID_LANGUAGES.includes(formal_language as any)) {
      return { variant: 'invalid', message: `Invalid formal_language "${formal_language}". Must be one of: ${VALID_LANGUAGES.join(', ')}` };
    }
    if (!VALID_SCOPES.includes(scope as any)) {
      return { variant: 'invalid', message: `Invalid scope "${scope}". Must be one of: ${VALID_SCOPES.join(', ')}` };
    }
    if (!VALID_PRIORITIES.includes(priority as any)) {
      return { variant: 'invalid', message: `Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}` };
    }

    const id = `fp-${simpleHash(name + ':' + target_symbol + ':' + expression)}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      id,
      name,
      kind,
      formal_language,
      expression,
      target_symbol,
      scope,
      priority,
      status: 'unproven',
      ghost: false,
      evidence_ref: '',
      created_at: now,
      updated_at: now,
    });

    return { variant: 'ok', id, name, kind, status: 'unproven' };
  },

  async prove(input, storage) {
    const id = input.id as string;
    const evidence_ref = input.evidence_ref as string;

    const property = await storage.get(RELATION, id);
    if (!property) {
      return { variant: 'notfound', id };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, id, {
      ...property,
      status: 'proved',
      evidence_ref,
      updated_at: now,
    });

    return { variant: 'ok', id, status: 'proved', evidence_ref };
  },

  async refute(input, storage) {
    const id = input.id as string;
    const evidence_ref = input.evidence_ref as string;

    const property = await storage.get(RELATION, id);
    if (!property) {
      return { variant: 'notfound', id };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, id, {
      ...property,
      status: 'refuted',
      evidence_ref,
      updated_at: now,
    });

    return { variant: 'ok', id, status: 'refuted', evidence_ref };
  },

  async check(input, storage) {
    const id = input.id as string;
    const solver = input.solver as string | undefined;

    const property = await storage.get(RELATION, id);
    if (!property) {
      return { variant: 'notfound', id };
    }

    // Mock implementation: simulate solver dispatch result.
    // Real implementation dispatches via SolverProvider sync concept.
    const mockStatuses = ['proved', 'refuted', 'unknown'] as const;
    const simulated = mockStatuses[Math.abs(simpleHash(id + (solver || '')).charCodeAt(7)) % 3];

    return {
      variant: 'ok',
      id,
      current_status: property.status as string,
      check_result: simulated,
      solver: solver || 'mock',
    };
  },

  async synthesize(input, storage) {
    const intent_ref = input.intent_ref as string;
    const target_symbol = input.target_symbol as string;
    const formal_language = (input.formal_language as string) || 'smtlib';

    // Mock: generate placeholder properties from intent reference
    const propertyIds: string[] = [];
    const placeholders = [
      { kind: 'invariant', expr: `(assert (> ${target_symbol}_value 0))` },
      { kind: 'precondition', expr: `(assert (not (= ${target_symbol}_input nil)))` },
      { kind: 'postcondition', expr: `(assert (= ${target_symbol}_result expected))` },
    ];

    const now = new Date().toISOString();
    for (const placeholder of placeholders) {
      const id = `fp-${simpleHash(intent_ref + ':' + placeholder.kind + ':' + target_symbol)}`;
      await storage.put(RELATION, id, {
        id,
        name: `${placeholder.kind} for ${target_symbol} (synthesized)`,
        kind: placeholder.kind,
        formal_language,
        expression: placeholder.expr,
        target_symbol,
        scope: 'local',
        priority: 'recommended',
        status: 'unproven',
        ghost: false,
        evidence_ref: '',
        intent_ref,
        created_at: now,
        updated_at: now,
      });
      propertyIds.push(id);
    }

    return { variant: 'ok', intent_ref, property_ids: JSON.stringify(propertyIds), count: propertyIds.length };
  },

  async coverage(input, storage) {
    const target_symbol = input.target_symbol as string;

    const all = await storage.find(RELATION);
    const matching = all.filter((p: any) => p.target_symbol === target_symbol);

    const byStatus: Record<string, number> = { proved: 0, refuted: 0, unproven: 0, unknown: 0 };
    for (const prop of matching) {
      const status = prop.status as string;
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    const total = matching.length;
    const coverage_pct = total > 0 ? byStatus.proved / total : 0;

    return {
      variant: 'ok',
      target_symbol,
      total,
      proved: byStatus.proved,
      refuted: byStatus.refuted,
      unproven: byStatus.unproven,
      coverage_pct,
    };
  },

  async list(input, storage) {
    const target_symbol = input.target_symbol as string | undefined;
    const kind = input.kind as string | undefined;
    const status = input.status as string | undefined;

    let all = await storage.find(RELATION);

    if (target_symbol) {
      all = all.filter((p: any) => p.target_symbol === target_symbol);
    }
    if (kind) {
      all = all.filter((p: any) => p.kind === kind);
    }
    if (status) {
      all = all.filter((p: any) => p.status === status);
    }

    const items = all.map((p: any) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      formal_language: p.formal_language,
      target_symbol: p.target_symbol,
      status: p.status,
      priority: p.priority,
    }));

    return { variant: 'ok', items: JSON.stringify(items), count: items.length };
  },

  async invalidate(input, storage) {
    const id = input.id as string;

    const property = await storage.get(RELATION, id);
    if (!property) {
      return { variant: 'notfound', id };
    }

    const currentStatus = property.status as string;
    if (currentStatus !== 'proved' && currentStatus !== 'refuted') {
      return { variant: 'unchanged', id, status: currentStatus, message: 'Property is already unproven' };
    }

    const now = new Date().toISOString();
    await storage.put(RELATION, id, {
      ...property,
      status: 'unproven',
      evidence_ref: '',
      updated_at: now,
    });

    return { variant: 'ok', id, previous_status: currentStatus, status: 'unproven' };
  },
};
