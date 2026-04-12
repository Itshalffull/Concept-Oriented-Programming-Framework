// ParamExpr handler — functional StorageProgram style
// Typed, statically analyzable expressions that resolve values from
// placement context. Replaces opaque string expressions with first-class
// objects carrying kind, type info, and dependency metadata.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const VALID_SOURCES = new Set(['row', 'page', 'user', 'controls', 'selection', 'block']);
const VALID_TYPES = new Set(['String', 'Int', 'Float', 'Bool', 'DateTime', 'ID', 'Bytes']);

function isValidValueType(vt: string): boolean {
  return VALID_TYPES.has(vt) || vt.length > 0;
}

function parseJsonArray(s: string): unknown[] | null {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function parseJsonObject(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Compute dependency strings from a stored expression record. */
function computeDependencies(rec: Record<string, unknown>): string[] {
  const kind = rec.kind as string;
  if (kind === 'contextRef') {
    const source = rec.contextSource as string;
    const pathArr = parseJsonArray(rec.contextPath as string) || [];
    return [`${source}.${pathArr.join('.')}`];
  }
  // For computed, conditional, coalesce: dependencies are declared inline
  // in the stored record (pre-computed at creation time).
  const stored = rec.dependencies as string | undefined;
  if (stored) {
    return parseJsonArray(stored) as string[] || [];
  }
  return [];
}

/** Recursively resolve an expression against a parsed context object. */
function resolveExprRec(
  exprId: string,
  contextObj: Record<string, unknown>,
  allExprs: Map<string, Record<string, unknown>>,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const rec = allExprs.get(exprId);
  if (!rec) return { ok: false, message: `expression '${exprId}' not found` };

  const kind = rec.kind as string;

  if (kind === 'literal') {
    return { ok: true, value: rec.literalValue };
  }

  if (kind === 'contextRef') {
    const source = rec.contextSource as string;
    const pathArr = parseJsonArray(rec.contextPath as string) as string[];
    const sourceObj = contextObj[source];
    if (sourceObj == null || typeof sourceObj !== 'object') {
      return { ok: false, message: `context source '${source}' not found` };
    }
    let cur: unknown = sourceObj;
    for (const seg of pathArr) {
      if (cur == null || typeof cur !== 'object') {
        return { ok: false, message: `path segment '${seg}' not found in context` };
      }
      cur = (cur as Record<string, unknown>)[seg];
    }
    if (cur == null) {
      return { ok: false, message: `context path '${pathArr.join('.')}' resolved to null` };
    }
    return { ok: true, value: cur };
  }

  if (kind === 'computed') {
    const operandIds = parseJsonArray(rec.operands as string) as string[];
    const resolvedOperands: string[] = [];
    for (const opId of operandIds) {
      const r = resolveExprRec(opId, contextObj, allExprs);
      if (!r.ok) return r;
      resolvedOperands.push(String(r.value));
    }
    const op = rec.operator as string;
    if (op === 'concat') return { ok: true, value: resolvedOperands.join('') };
    if (op === 'toUpperCase') return { ok: true, value: resolvedOperands[0]?.toUpperCase() ?? '' };
    if (op === 'toLowerCase') return { ok: true, value: resolvedOperands[0]?.toLowerCase() ?? '' };
    // Generic: return JSON of resolved values for unknown operators
    return { ok: true, value: JSON.stringify(resolvedOperands) };
  }

  if (kind === 'conditional') {
    const predId = rec.predicateExpr as string;
    const thenId = rec.thenExpr as string;
    const elseId = rec.elseExpr as string;
    const pr = resolveExprRec(predId, contextObj, allExprs);
    if (!pr.ok) return pr;
    const truthy = Boolean(pr.value) && pr.value !== 'false' && pr.value !== '0';
    return resolveExprRec(truthy ? thenId : elseId, contextObj, allExprs);
  }

  if (kind === 'coalesce') {
    const altIds = parseJsonArray(rec.alternatives as string) as string[];
    for (const altId of altIds) {
      const r = resolveExprRec(altId, contextObj, allExprs);
      if (r.ok && r.value != null) return r;
    }
    return { ok: false, message: 'all alternatives resolved to null' };
  }

  return { ok: false, message: `unknown expression kind '${kind}'` };
}

const _handler: FunctionalConceptHandler = {

  register() {
    return { name: 'ParamExpr' };
  },

  literal(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const value = (input.value as string) ?? '';
    const valueType = (input.valueType as string) || '';

    if (!expr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'expr identifier is required' });
    }
    if (value === '') {
      return complete(createProgram(), 'invalid', { message: 'value is required for literal expressions' });
    }
    if (!valueType.trim()) {
      return complete(createProgram(), 'invalid', { message: 'valueType is required' });
    }

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'invalid', { message: `expression '${expr}' already exists` }),
      (b) => {
        const rec = {
          expr,
          kind: 'literal',
          valueType,
          literalValue: value,
          dependencies: '[]',
        };
        let b2 = put(b, 'expressions', expr, rec);
        return complete(b2, 'ok', { expr });
      },
    );
  },

  contextRef(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const source = (input.source as string) || '';
    const path = (input.path as string) || '';
    const valueType = (input.valueType as string) || '';

    if (!expr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'expr identifier is required' });
    }
    if (!VALID_SOURCES.has(source)) {
      return complete(createProgram(), 'invalid', {
        message: `source must be one of: ${[...VALID_SOURCES].join(', ')}`,
      });
    }
    const pathArr = parseJsonArray(path);
    if (!pathArr || pathArr.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'path must be a non-empty JSON array of strings' });
    }
    if (!valueType.trim()) {
      return complete(createProgram(), 'invalid', { message: 'valueType is required' });
    }

    const depKey = `${source}.${(pathArr as string[]).join('.')}`;

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'invalid', { message: `expression '${expr}' already exists` }),
      (b) => {
        const rec = {
          expr,
          kind: 'contextRef',
          valueType,
          contextSource: source,
          contextPath: path,
          dependencies: JSON.stringify([depKey]),
        };
        let b2 = put(b, 'expressions', expr, rec);
        return complete(b2, 'ok', { expr });
      },
    );
  },

  computed(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const operator = (input.operator as string) || '';
    const operands = (input.operands as string) || '';
    const valueType = (input.valueType as string) || '';

    if (!expr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'expr identifier is required' });
    }
    if (!operator.trim()) {
      return complete(createProgram(), 'invalid', { message: 'operator is required' });
    }
    const operandArr = parseJsonArray(operands);
    if (!operandArr || operandArr.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'operands must be a non-empty JSON array' });
    }
    if (!valueType.trim()) {
      return complete(createProgram(), 'invalid', { message: 'valueType is required' });
    }

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'invalid', { message: `expression '${expr}' already exists` }),
      (b) => {
        const rec = {
          expr,
          kind: 'computed',
          valueType,
          operator,
          operands,
          dependencies: '[]',
        };
        let b2 = put(b, 'expressions', expr, rec);
        return complete(b2, 'ok', { expr });
      },
    );
  },

  conditional(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const predicateExpr = (input.predicateExpr as string) || '';
    const thenExpr = (input.thenExpr as string) || '';
    const elseExpr = (input.elseExpr as string) || '';
    const valueType = (input.valueType as string) || '';

    if (!expr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'expr identifier is required' });
    }
    if (!predicateExpr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'predicateExpr is required' });
    }
    if (!thenExpr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'thenExpr is required' });
    }
    if (!elseExpr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'elseExpr is required' });
    }
    if (!valueType.trim()) {
      return complete(createProgram(), 'invalid', { message: 'valueType is required' });
    }

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'invalid', { message: `expression '${expr}' already exists` }),
      (b) => {
        const rec = {
          expr,
          kind: 'conditional',
          valueType,
          predicateExpr,
          thenExpr,
          elseExpr,
          dependencies: '[]',
        };
        let b2 = put(b, 'expressions', expr, rec);
        return complete(b2, 'ok', { expr });
      },
    );
  },

  coalesce(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const alternatives = (input.alternatives as string) || '';
    const valueType = (input.valueType as string) || '';

    if (!expr.trim()) {
      return complete(createProgram(), 'invalid', { message: 'expr identifier is required' });
    }
    const altArr = parseJsonArray(alternatives);
    if (!altArr || altArr.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'alternatives must be a non-empty JSON array' });
    }
    if (!valueType.trim()) {
      return complete(createProgram(), 'invalid', { message: 'valueType is required' });
    }

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'invalid', { message: `expression '${expr}' already exists` }),
      (b) => {
        const rec = {
          expr,
          kind: 'coalesce',
          valueType,
          alternatives,
          dependencies: '[]',
        };
        let b2 = put(b, 'expressions', expr, rec);
        return complete(b2, 'ok', { expr });
      },
    );
  },

  resolve(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const context = (input.context as string) || '{}';

    const contextObj = parseJsonObject(context);
    if (contextObj === null) {
      return complete(createProgram(), 'unresolvable', {
        message: 'context is not a valid JSON object',
      });
    }

    let p = createProgram();
    p = get(p, 'expressions', expr, 'target');
    return branch(p,
      (b) => !b.target,
      (b) => complete(b, 'notfound', { message: `expression '${expr}' not found` }),
      (b) => {
        // Load all expressions for recursive resolution
        let b2 = find(b, 'expressions', {}, 'allExprs');
        // Compute resolution result and store in bindings
        b2 = mapBindings(b2, (bindings) => {
          const target = bindings.target as Record<string, unknown>;
          const allList = (bindings.allExprs || []) as Record<string, unknown>[];
          const allMap = new Map<string, Record<string, unknown>>();
          for (const e of allList) {
            if (e.expr) allMap.set(e.expr as string, e);
          }
          allMap.set(expr, target);
          const result = resolveExprRec(expr, contextObj!, allMap);
          return result;
        }, '_resolveResult');
        // Branch on resolution success
        return branch(b2,
          (bindings) => (bindings._resolveResult as { ok: boolean }).ok === true,
          (bp) => completeFrom(bp, 'ok', (bindings) => {
            const target = bindings.target as Record<string, unknown>;
            const res = bindings._resolveResult as { ok: true; value: unknown };
            return {
              value: String(res.value),
              valueType: target.valueType as string,
            };
          }),
          (bp) => completeFrom(bp, 'unresolvable', (bindings) => {
            const res = bindings._resolveResult as { ok: false; message: string };
            return { message: res.message };
          }),
        );
      },
    );
  },

  validate(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';
    const availableFields = (input.availableFields as string) || '[]';

    const fieldArr = parseJsonArray(availableFields) as string[] | null;
    const fieldSet = new Set(fieldArr || []);

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `expression '${expr}' not found` }),
      (b) => {
        // Compute missing refs and store in bindings
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const deps = computeDependencies(rec);
          return deps.filter(d => !fieldSet.has(d));
        }, '_missingRefs');
        // Branch on whether there are missing refs
        return branch(b2,
          (bindings) => (bindings._missingRefs as string[]).length > 0,
          (bp) => completeFrom(bp, 'invalid', (bindings) => ({
            missingRefs: JSON.stringify(bindings._missingRefs as string[]),
          })),
          (bp) => complete(bp, 'ok', { expr }),
        );
      },
    );
  },

  extractDependencies(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `expression '${expr}' not found` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const deps = computeDependencies(rec);
          return { dependencies: JSON.stringify(deps) };
        });
      },
    );
  },

  get(input: Record<string, unknown>) {
    const expr = (input.expr as string) || '';

    let p = createProgram();
    p = get(p, 'expressions', expr, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `expression '${expr}' not found` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const deps = computeDependencies(rec);
          return {
            expr: rec.expr ?? expr,
            kind: rec.kind as string,
            valueType: rec.valueType as string,
            dependencies: JSON.stringify(deps),
          };
        });
      },
    );
  },
};

export const paramExprHandler = autoInterpret(_handler);
