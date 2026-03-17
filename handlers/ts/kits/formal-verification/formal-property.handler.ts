// FormalProperty Concept Implementation — Formal Verification Suite
// Define, prove, refute, and track formal properties (invariants, pre/postconditions,
// temporal/safety/liveness properties) across multiple formal languages and solvers.
//
// Migrated to FunctionalConceptHandler: each action returns a StorageProgram
// instead of directly executing storage effects. This enables the monadic
// analysis pipeline (InvariantExtractionProvider, ReadWriteSetProvider,
// CommutativityProvider, DeadBranchProvider) to analyze and verify these
// handlers — the FV suite verifying itself.
// See Architecture doc Section 18.1

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, pure,
  type StorageProgram,
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
    // Also accept formula+language from publish-extracted-properties sync
    const formula = input.formula as string | undefined;
    const language = input.language as string | undefined;

    const effectiveExpression = expression || formula || '';
    const effectiveLanguage = formal_language || language || 'smtlib';

    if (!VALID_KINDS.includes(kind as any)) {
      return pure(createProgram(), { variant: 'invalid', message: `Invalid kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}` }) as StorageProgram<Result>;
    }
    if (!VALID_LANGUAGES.includes(effectiveLanguage as any)) {
      return pure(createProgram(), { variant: 'invalid', message: `Invalid formal_language "${effectiveLanguage}". Must be one of: ${VALID_LANGUAGES.join(', ')}` }) as StorageProgram<Result>;
    }
    if (scope && !VALID_SCOPES.includes(scope as any)) {
      return pure(createProgram(), { variant: 'invalid', message: `Invalid scope "${scope}". Must be one of: ${VALID_SCOPES.join(', ')}` }) as StorageProgram<Result>;
    }
    if (priority && !VALID_PRIORITIES.includes(priority as any)) {
      return pure(createProgram(), { variant: 'invalid', message: `Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(', ')}` }) as StorageProgram<Result>;
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
    return pure(p, { variant: 'ok', id, name, kind, status: 'unproven' }) as StorageProgram<Result>;
  },

  prove(input) {
    const id = input.id as string;
    const evidence_ref = input.evidence_ref as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'property');
    p = branch(
      p,
      (bindings) => bindings.property == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        let inner = createProgram();
        inner = put(inner, RELATION, id, {
          __merge: true,
          status: 'proved',
          evidence_ref,
          updated_at: now,
        });
        return pure(inner, { variant: 'ok', id, status: 'proved', evidence_ref });
      })(),
    );
    return p as StorageProgram<Result>;
  },

  refute(input) {
    const id = input.id as string;
    const evidence_ref = input.evidence_ref as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'property');
    p = branch(
      p,
      (bindings) => bindings.property == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        let inner = createProgram();
        inner = put(inner, RELATION, id, {
          __merge: true,
          status: 'refuted',
          evidence_ref,
          updated_at: now,
        });
        return pure(inner, { variant: 'ok', id, status: 'refuted', evidence_ref });
      })(),
    );
    return p as StorageProgram<Result>;
  },

  check(input) {
    const id = input.id as string;
    const solver = input.solver as string | undefined;

    let p = createProgram();
    p = get(p, RELATION, id, 'property');
    p = branch(
      p,
      (bindings) => bindings.property == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        // Mock: simulate solver dispatch. Real impl dispatches via SolverProvider.
        const mockStatuses = ['proved', 'refuted', 'unknown'] as const;
        const simulated = mockStatuses[Math.abs(simpleHash(id + (solver || '')).charCodeAt(7)) % 3];
        return pure(createProgram(), {
          variant: 'ok',
          id,
          current_status: '__binding:property.status',
          check_result: simulated,
          solver: solver || 'mock',
        });
      })(),
    );
    return p as StorageProgram<Result>;
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

    return pure(p, {
      variant: 'ok',
      intent_ref,
      property_ids: JSON.stringify(propertyIds),
      count: propertyIds.length,
    }) as StorageProgram<Result>;
  },

  coverage(input) {
    const target_symbol = input.target_symbol as string;

    let p = createProgram();
    p = find(p, RELATION, {}, 'all_properties');
    // The interpreter resolves the binding and applies the filter+aggregation.
    // We encode the computation as a pure return referencing the binding.
    return pure(p, {
      variant: 'ok',
      target_symbol,
      __compute: 'coverage',
      __filter: { target_symbol },
    }) as StorageProgram<Result>;
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
    return pure(p, {
      variant: 'ok',
      __compute: 'list',
      __fields: ['id', 'name', 'kind', 'formal_language', 'target_symbol', 'status', 'priority'],
    }) as StorageProgram<Result>;
  },

  invalidate(input) {
    const id = input.id as string;
    const now = new Date().toISOString();

    let p = createProgram();
    p = get(p, RELATION, id, 'property');
    p = branch(
      p,
      (bindings) => bindings.property == null,
      pure(createProgram(), { variant: 'notfound', id }),
      (() => {
        // Branch again on status — only proved/refuted can be invalidated
        let inner = createProgram();
        inner = branch(
          inner,
          (bindings) => {
            const prop = bindings.property as Record<string, unknown>;
            return prop.status !== 'proved' && prop.status !== 'refuted';
          },
          pure(createProgram(), { variant: 'unchanged', id, status: '__binding:property.status', message: 'Property is already unproven' }),
          (() => {
            let write = createProgram();
            write = put(write, RELATION, id, {
              __merge: true,
              status: 'unproven',
              evidence_ref: '',
              updated_at: now,
            });
            return pure(write, { variant: 'ok', id, previous_status: '__binding:property.status', status: 'unproven' });
          })(),
        );
        return inner;
      })(),
    );
    return p as StorageProgram<Result>;
  },
};
