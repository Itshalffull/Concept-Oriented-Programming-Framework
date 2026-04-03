// @clef-handler style=functional
// FormulaField Concept Implementation
//
// Evaluate computed field expressions at five attachment scopes:
//   entity   — against a single entity's field values
//   schema   — applied to all entities bearing a given schema name
//   view     — aggregations (sum/count/avg/min/max) across a view's data set
//   global   — shared constants with no entity context
//   relation — rollup aggregates across all entities linked via a relation
//
// See Architecture doc Section 16 (SlotSource / Formula evaluation).

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get as spGet,
  find,
  put,
  putFrom,
  del,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_SCOPES = new Set(['entity', 'schema', 'view', 'global', 'relation']);

// ─── Expression evaluation helpers ──────────────────────────────────────────

/**
 * Safe arithmetic/string expression evaluator.
 * Binds variable names from `context` and evaluates numeric-safe expressions.
 */
function evalExpression(expression: string, context: Record<string, unknown>): string {
  // Security: forbid function bodies, imports, eval, etc.
  const forbidden = /[;{}]|function\s|=>|import\b|require\b|\beval\b|new\s+Function/;
  if (forbidden.test(expression)) {
    throw new Error(`Expression contains forbidden syntax: ${expression}`);
  }

  // Replace variable references with their values
  let resolved = expression;
  for (const [key, val] of Object.entries(context)) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    resolved = resolved.replace(regex, String(val ?? 0));
  }

  // Check for string concatenation (non-numeric)
  if (resolved.includes("'") || resolved.includes('"')) {
    // Simple string concat: evaluate the JS
    try {
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${resolved});`)();
      return String(result);
    } catch (err) {
      throw new Error(`String expression error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Numeric-only expression
  const sanitized = resolved.replace(/[^0-9+\-*/().%\s]/g, '').trim();
  if (sanitized.length === 0) return resolved.trim() || '0';

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${sanitized});`)();
    if (typeof result === 'number' && !isNaN(result)) return String(result);
    return String(result);
  } catch (err) {
    throw new Error(`Evaluation error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Evaluate aggregate functions (sum/count/avg/min/max) over an array of rows.
 * Syntax: sum(field), count(field), avg(field), min(field), max(field)
 */
function evalAggregate(expression: string, rows: Record<string, unknown>[]): string {
  const aggMatch = expression.trim().match(/^(sum|count|avg|min|max)\((\w+)\)$/i);
  if (aggMatch) {
    const fn = aggMatch[1].toLowerCase();
    const field = aggMatch[2];
    const values = rows
      .map(r => Number(r[field] ?? 0))
      .filter(v => !isNaN(v));

    switch (fn) {
      case 'count': return String(rows.length);
      case 'sum':   return String(values.reduce((a, b) => a + b, 0));
      case 'avg':   return values.length === 0 ? '0'
        : String(values.reduce((a, b) => a + b, 0) / values.length);
      case 'min':   return values.length === 0 ? '0' : String(Math.min(...values));
      case 'max':   return values.length === 0 ? '0' : String(Math.max(...values));
    }
  }

  // Compound expression with aggregates: replace each agg(field) with its value
  let resolved = expression;
  const aggPattern = /(sum|count|avg|min|max)\((\w+)\)/gi;
  resolved = resolved.replace(aggPattern, (_, fn, field) => {
    const values = rows
      .map(r => Number(r[field] ?? 0))
      .filter(v => !isNaN(v));
    switch (fn.toLowerCase()) {
      case 'count': return String(rows.length);
      case 'sum':   return String(values.reduce((a, b) => a + b, 0));
      case 'avg':   return values.length === 0 ? '0'
        : String(values.reduce((a, b) => a + b, 0) / values.length);
      case 'min':   return values.length === 0 ? '0' : String(Math.min(...values));
      case 'max':   return values.length === 0 ? '0' : String(Math.max(...values));
      default: return '0';
    }
  });

  // Now evaluate the remaining arithmetic
  const sanitized = resolved.replace(/[^0-9+\-*/().%\s]/g, '').trim();
  if (!sanitized) return '0';
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return String(result);
  } catch {
    return '0';
  }
}

// ─── Storage key helpers ─────────────────────────────────────────────────────

/** Storage key: formula-field records indexed by name */
const RELATION = 'formula-field';

function buildRecord(
  name: string,
  expression: string,
  scope: string,
  attachTo: string,
): Record<string, unknown> {
  return {
    field: name,
    name,
    expression,
    scope,
    attachTo,
    cachedResult: '',
    lastEvaluated: '',
    createdAt: new Date().toISOString(),
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>): StorageProgram<Result> {
    const name = (input.name as string) ?? '';
    const expression = (input.expression as string) ?? '';
    const scope = (input.scope as string) ?? '';
    const attachTo = (input.attachTo as string) ?? '';

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }
    if (!expression || expression.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'expression is required',
      }) as StorageProgram<Result>;
    }
    if (!VALID_SCOPES.has(scope)) {
      return complete(createProgram(), 'error', {
        message: `scope must be one of: ${[...VALID_SCOPES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, RELATION, name, 'existing');
    return branch(
      p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { name }),
      (b) => {
        const record = buildRecord(name, expression, scope, attachTo);
        let b2 = put(b, RELATION, name, record);
        return complete(b2, 'ok', { field: name });
      },
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>): StorageProgram<Result> {
    const fieldId = (input.field as string) ?? '';
    const contextRaw = (input.context as string) ?? '{}';

    // Validate context JSON before storage lookup
    let context: Record<string, unknown>;
    try {
      context = JSON.parse(contextRaw);
    } catch {
      return complete(createProgram(), 'error', {
        message: `context is not valid JSON: ${contextRaw}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, RELATION, fieldId, 'fieldRecord');
    // Derive evaluation result at runtime from the bound fieldRecord
    p = mapBindings(p, (bindings) => {
      const rec = bindings.fieldRecord as Record<string, unknown> | undefined;
      if (!rec) return null;
      try {
        return { ok: true, result: evalExpression(rec.expression as string, context), rec };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err), rec };
      }
    }, '_eval');
    return branch(
      p,
      (b) => !b.fieldRecord,
      (b) => complete(b, 'notfound', { message: `Formula field '${fieldId}' not found` }),
      (b) => branch(
        b,
        (bindings) => {
          const ev = bindings._eval as { ok: boolean } | null;
          return !ev || !ev.ok;
        },
        (b2) => completeFrom(b2, 'error', (bindings) => {
          const ev = bindings._eval as { ok: boolean; message?: string } | null;
          return { message: ev?.message ?? 'Evaluation failed' };
        }),
        (b2) => {
          let b3 = putFrom(b2, RELATION, fieldId, (bindings) => {
            const ev = bindings._eval as { ok: boolean; result: string; rec: Record<string, unknown> };
            return { ...ev.rec, cachedResult: ev.result, lastEvaluated: new Date().toISOString() };
          });
          return completeFrom(b3, 'ok', (bindings) => {
            const ev = bindings._eval as { ok: boolean; result: string };
            return { result: ev.result };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  evaluateForEntity(input: Record<string, unknown>): StorageProgram<Result> {
    const fieldId = (input.field as string) ?? '';
    const entityId = (input.entityId as string) ?? '';
    const entityDataRaw = (input.entityData as string) ?? '{}';

    let entityData: Record<string, unknown>;
    try {
      entityData = JSON.parse(entityDataRaw);
    } catch {
      return complete(createProgram(), 'error', {
        message: `entityData is not valid JSON: ${entityDataRaw}`,
      }) as StorageProgram<Result>;
    }

    const context = { ...entityData, _entityId: entityId };

    let p = createProgram();
    p = spGet(p, RELATION, fieldId, 'fieldRecord');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.fieldRecord as Record<string, unknown> | undefined;
      if (!rec) return null;
      try {
        return { ok: true, result: evalExpression(rec.expression as string, context), rec };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err), rec };
      }
    }, '_eval');
    return branch(
      p,
      (b) => !b.fieldRecord,
      (b) => complete(b, 'notfound', { message: `Formula field '${fieldId}' not found` }),
      (b) => branch(
        b,
        (bindings) => {
          const ev = bindings._eval as { ok: boolean } | null;
          return !ev || !ev.ok;
        },
        (b2) => completeFrom(b2, 'error', (bindings) => {
          const ev = bindings._eval as { ok: boolean; message?: string } | null;
          return { message: ev?.message ?? 'Evaluation failed' };
        }),
        (b2) => {
          let b3 = putFrom(b2, RELATION, fieldId, (bindings) => {
            const ev = bindings._eval as { ok: boolean; result: string; rec: Record<string, unknown> };
            return { ...ev.rec, cachedResult: ev.result, lastEvaluated: new Date().toISOString() };
          });
          return completeFrom(b3, 'ok', (bindings) => {
            const ev = bindings._eval as { ok: boolean; result: string };
            return { result: ev.result };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  evaluateAggregate(input: Record<string, unknown>): StorageProgram<Result> {
    const fieldId = (input.field as string) ?? '';
    const rowsRaw = (input.rows as string) ?? '[]';

    let rows: Record<string, unknown>[];
    try {
      const parsed = JSON.parse(rowsRaw);
      if (!Array.isArray(parsed)) throw new Error('rows must be a JSON array');
      rows = parsed as Record<string, unknown>[];
    } catch (err) {
      return complete(createProgram(), 'error', {
        message: `rows is not a valid JSON array: ${err instanceof Error ? err.message : String(err)}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, RELATION, fieldId, 'fieldRecord');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.fieldRecord as Record<string, unknown> | undefined;
      if (!rec) return null;
      const scope = rec.scope as string;
      if (scope !== 'view' && scope !== 'relation') {
        return { ok: false, message: `Aggregate evaluation requires scope 'view' or 'relation', got '${scope}'`, rec };
      }
      try {
        return { ok: true, result: evalAggregate(rec.expression as string, rows), rec };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err), rec };
      }
    }, '_eval');
    return branch(
      p,
      (b) => !b.fieldRecord,
      (b) => complete(b, 'notfound', { message: `Formula field '${fieldId}' not found` }),
      (b) => branch(
        b,
        (bindings) => {
          const ev = bindings._eval as { ok: boolean } | null;
          return !ev || !ev.ok;
        },
        (b2) => completeFrom(b2, 'error', (bindings) => {
          const ev = bindings._eval as { ok: boolean; message?: string } | null;
          return { message: ev?.message ?? 'Evaluation failed' };
        }),
        (b2) => {
          let b3 = putFrom(b2, RELATION, fieldId, (bindings) => {
            const ev = bindings._eval as { ok: boolean; result: string; rec: Record<string, unknown> };
            return { ...ev.rec, cachedResult: ev.result, lastEvaluated: new Date().toISOString() };
          });
          return completeFrom(b3, 'ok', (bindings) => {
            const ev = bindings._eval as { ok: boolean; result: string };
            return { result: ev.result };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>): StorageProgram<Result> {
    let p = createProgram();
    p = find(p, RELATION, {}, '_all');
    return completeFrom(p, 'ok', (b) => {
      const all = (b._all as Record<string, unknown>[]) ?? [];
      const fields = all.map(r => ({
        field: r.field,
        name: r.name,
        expression: r.expression,
        scope: r.scope,
        attachTo: r.attachTo,
      }));
      return { fields: JSON.stringify(fields) };
    }) as StorageProgram<Result>;
  },

  listByScope(input: Record<string, unknown>): StorageProgram<Result> {
    const scope = (input.scope as string) ?? '';
    if (!VALID_SCOPES.has(scope)) {
      return complete(createProgram(), 'error', {
        message: `scope must be one of: ${[...VALID_SCOPES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, RELATION, {}, '_all');
    p = mapBindings(p, (b) => {
      const all = (b._all as Record<string, unknown>[]) ?? [];
      return all.filter(r => r.scope === scope);
    }, '_filtered');
    return completeFrom(p, 'ok', (b) => {
      const filtered = (b._filtered as Record<string, unknown>[]) ?? [];
      const fields = filtered.map(r => ({
        field: r.field,
        name: r.name,
        expression: r.expression,
        scope: r.scope,
        attachTo: r.attachTo,
      }));
      return { fields: JSON.stringify(fields) };
    }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>): StorageProgram<Result> {
    const fieldId = (input.field as string) ?? '';

    let p = createProgram();
    p = spGet(p, RELATION, fieldId, 'existing');
    return branch(
      p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `Formula field '${fieldId}' not found` }),
      (b) => {
        let b2 = del(b, RELATION, fieldId);
        return complete(b2, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },
};

export const formulaFieldHandler = autoInterpret(_handler);
