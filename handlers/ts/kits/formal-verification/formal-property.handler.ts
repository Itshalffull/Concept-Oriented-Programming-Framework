// @clef-handler style=imperative
// FormalProperty Concept Implementation — Formal Verification Suite
// Define, prove, refute, and track formal properties (invariants, pre/postconditions,
// temporal/safety/liveness properties) across multiple formal languages and solvers.
//
// FunctionalConceptHandler: each action returns a StorageProgram — pure data
// describing storage effects. No async, no side effects, fully inspectable
// by the monadic analysis pipeline.
// See Architecture doc Section 18.1

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, merge, branch, mapBindings, completeFrom,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

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
const VALID_LANGUAGES = ['smtlib', 'tlaplus', 'alloy', 'lean', 'dafny', 'cvl', 'clef-invariant'] as const;
const VALID_SCOPES = ['local', 'global', 'sync'] as const;
const VALID_PRIORITIES = ['required', 'recommended', 'optional'] as const;

type Result = { variant: string; [key: string]: unknown };

export const formalPropertyHandler: FunctionalConceptHandler = {
  define(input) {
    const name = input.name as string;
    const kind = input.kind as string;
    const formal_language = input.formal_language as string;
    const expression = input.expression as string;
    const target_symbol = input.target_symbol as string;
    const scope = input.scope as string;
    const priority = input.priority as string;
    const formula = input.formula as string | undefined;
    const language = input.language as string | undefined;

    const effectiveExpression = expression || formula || '';
    const effectiveLanguage = formal_language || language || 'smtlib';

    if (!VALID_KINDS.includes(kind as any)) {
      return complete(createProgram(), 'invalid', { message: `Invalid kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}` }) as StorageProgram<Result>;
    }
    if (!VALID_LANGUAGES.includes(effectiveLanguage as any)) {
      return complete(createProgram(), 'invalid', { message: `Invalid formal_language "${effectiveLanguage}". Must be one of: ${VALID_LANGUAGES.join(', ')}` }) as StorageProgram<Result>;
    }
    if (scope && !VALID_SCOPES.includes(scope as any)) {
      return complete(createProgram(), 'invalid', { message: `Invalid scope "${scope}". Must be one of: ${VALID_SCOPES.join(', ')}` }) as StorageProgram<Result>;
    }
    if (priority && !VALID_PRIORITIES.includes(priority as any)) {
      return complete(createProgram(), 'invalid', { message: `Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}` }) as StorageProgram<Result>;
    }

    const id = `fp-${simpleHash(name + ':' + target_symbol + ':' + effectiveExpression)}`;
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, RELATION, id, {
      id,
      name,
      kind,
      formal_language: effectiveLanguage,
      expression: effectiveExpression,
      target_symbol,
      scope: scope || 'local',
      priority: priority || 'recommended',
      status: 'unproven',
      ghost: false,
      evidence_ref: '',
      created_at: now,
      updated_at: now,
    });
    // Output both 'id' and 'property' so fixture pool overrides work
    return complete(p, 'ok', { id, property: id, name, kind, status: 'unproven' }) as StorageProgram<Result>;
  },

  prove(input) {
    const id = (input.id || input.property) as string;
    const evidence_ref = input.evidence_ref as string;
    const now = new Date().toISOString();

    if (!id) {
      return complete(createProgram(), 'notfound', { message: 'id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, id, 'propRecord');
    return branch(p, 'propRecord',
      (thenP) => {
        let b = merge(thenP, RELATION, id, { status: 'proved', evidence_ref, updated_at: now });
        return complete(b, 'ok', { id, status: 'proved', evidence_ref });
      },
      (elseP) => complete(elseP, 'notfound', { id }),
    ) as StorageProgram<Result>;
  },

  refute(input) {
    const id = (input.id || input.property) as string;
    const evidence_ref = input.evidence_ref as string;
    const now = new Date().toISOString();

    if (!id) {
      return complete(createProgram(), 'notfound', { message: 'id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, id, 'propRecord');
    return branch(p, 'propRecord',
      (thenP) => {
        let b = merge(thenP, RELATION, id, { status: 'refuted', evidence_ref, updated_at: now });
        return complete(b, 'ok', { id, status: 'refuted', evidence_ref });
      },
      (elseP) => complete(elseP, 'notfound', { id }),
    ) as StorageProgram<Result>;
  },

  check(input) {
    const id = (input.id || input.property) as string;
    const solver = input.solver as string | undefined;

    if (!id) {
      return complete(createProgram(), 'notfound', { message: 'id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, id, 'propRecord');
    return branch(p, 'propRecord',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const prop = bindings.propRecord as Record<string, unknown>;
        const mockStatuses = ['proved', 'refuted', 'unknown'] as const;
        const simulated = mockStatuses[Math.abs(simpleHash(id + (solver || '')).charCodeAt(7)) % 3];
        return {
          id,
          current_status: prop.status,
          check_result: simulated,
          solver: solver || 'mock',
        };
      }),
      (elseP) => complete(elseP, 'notfound', { id }),
    ) as StorageProgram<Result>;
  },

  synthesize(input) {
    const intent_ref = input.intent_ref as string;
    const target_symbol = input.target_symbol as string;
    const formal_language = (input.formal_language as string) || 'smtlib';

    const placeholders = [
      { kind: 'invariant', expr: `(assert (> ${target_symbol}_value 0))` },
      { kind: 'precondition', expr: `(assert (not (= ${target_symbol}_input nil)))` },
      { kind: 'postcondition', expr: `(assert (= ${target_symbol}_result expected))` },
    ];

    const now = new Date().toISOString();
    const propertyIds: string[] = [];

    let p = createProgram();
    for (const placeholder of placeholders) {
      const propId = `fp-${simpleHash(intent_ref + ':' + placeholder.kind + ':' + target_symbol)}`;
      propertyIds.push(propId);
      p = put(p, RELATION, propId, {
        id: propId,
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
    }

    return complete(p, 'ok', { intent_ref,
      property_ids: JSON.stringify(propertyIds),
      count: propertyIds.length }) as StorageProgram<Result>;
  },

  coverage(input) {
    const target_symbol = input.target_symbol as string;

    let p = createProgram();
    p = find(p, RELATION, {}, 'all_properties');
    // Compute filtered list
    p = mapBindings(p, (bindings) => {
      const allProps = (bindings.all_properties as Record<string, unknown>[]) || [];
      return allProps.filter(prop => prop.target_symbol === target_symbol);
    }, 'filtered');

    return branch(p, (bindings) => (bindings.filtered as unknown[]).length === 0,
      (elseP) => complete(elseP, 'notfound', { target_symbol, message: `No properties found for "${target_symbol}"` }),
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const filtered = bindings.filtered as Record<string, unknown>[];
        const total = filtered.length;
        const proved = filtered.filter(prop => prop.status === 'proved').length;
        const refuted = filtered.filter(prop => prop.status === 'refuted').length;
        const unproven = total - proved - refuted;
        return {
          target_symbol,
          total,
          proved,
          refuted,
          unproven,
          coverage_pct: total === 0 ? 0 : proved / total,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(input) {
    const target_symbol = input.target_symbol as string | undefined;
    const kind = input.kind as string | undefined;
    const status = input.status as string | undefined;

    const criteria: Record<string, unknown> = {};
    if (target_symbol) criteria.target_symbol = target_symbol;
    if (kind) criteria.kind = kind;
    if (status) criteria.status = status;

    let p = createProgram();
    p = find(p, RELATION, criteria, 'items');
    return completeFrom(p, 'ok', (bindings) => {
      const items = (bindings.items as Record<string, unknown>[]) || [];
      const fields = ['id', 'name', 'kind', 'formal_language', 'target_symbol', 'status', 'priority'];
      const projected = items.map(item => {
        const result: Record<string, unknown> = {};
        for (const f of fields) result[f] = item[f];
        return result;
      });
      return {
        count: projected.length,
        items: JSON.stringify(projected),
      };
    }) as StorageProgram<Result>;
  },

  invalidate(input) {
    const id = (input.id || input.property) as string;
    const now = new Date().toISOString();

    if (!id) {
      return complete(createProgram(), 'notfound', { message: 'id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, RELATION, id, 'propRecord');
    return branch(p, 'propRecord',
      (thenP) => {
        // Only invalidate proved/refuted — unproven properties return notfound
        return branch(thenP, (bindings) => {
          const prop = bindings.propRecord as Record<string, unknown>;
          return prop.status !== 'proved' && prop.status !== 'refuted';
        },
          (notFoundP) => complete(notFoundP, 'notfound', { id }),
          (writeP) => {
            let bp = mapBindings(writeP, (bindings) => {
              const prop = bindings.propRecord as Record<string, unknown>;
              return prop.status;
            }, 'previousStatus');
            bp = merge(bp, RELATION, id, { status: 'unproven', evidence_ref: '', updated_at: now });
            return completeFrom(bp, 'ok', (bindings) => ({
              id,
              previous_status: bindings.previousStatus,
              status: 'unproven',
            }));
          },
        );
      },
      (elseP) => complete(elseP, 'notfound', { id }),
    ) as StorageProgram<Result>;
  },
};
