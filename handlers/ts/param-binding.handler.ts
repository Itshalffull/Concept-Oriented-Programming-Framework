// @clef-handler style=functional
// ============================================================
// ParamBinding Handler
//
// General-purpose variable binding that connects data sources to data sinks
// through controls. Bindings extract a value from a source (entity field,
// URL parameter, relation traversal, control state, or literal), optionally
// transform it, and place it at a target (URL param, view filter, action
// input, control prop, or navigate href).
//
// All six actions are implemented in functional (StorageProgram) style.
// resolve() dispatches through VariableProgram for typed access-path
// evaluation, falling back to the inline evaluator for backward
// compatibility when VariableProgram is unavailable or the program
// cannot be fully resolved without live source providers.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, delFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { variableProgramHandler } from './variable-program/variable-program.handler.ts';
import { createInMemoryStorage } from '../../runtime/adapters/storage.ts';
import type { ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

// Valid enum values from the concept spec
const VALID_SOURCE_KINDS = new Set(['field', 'url-param', 'relation', 'control', 'literal']);
const VALID_TARGET_KINDS = new Set(['url-param', 'view-filter', 'action-input', 'control-prop', 'navigate']);
const VALID_TRIGGER_EVENTS = new Set(['click', 'change', 'load', 'submit', 'manual']);

interface ParamBindingRecord {
  binding: string;
  name: string;
  scopeRef: string;
  sourceKind: string;
  sourceExpression: string;
  targetKind: string;
  targetExpression: string;
  triggerEvent: string;
  transformExpression: string | null;
}

/**
 * Evaluate a dot-notation expression path against a parsed data object.
 * Returns the value at the path, or undefined if any segment is missing.
 */
function evaluatePath(data: Record<string, unknown>, expression: string): unknown {
  const parts = expression.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Apply a named transform to a value string.
 * Supports: encodeURIComponent, toString, parseInt, toLowerCase.
 * Returns the transformed string, or undefined if transform is unknown.
 */
function applyTransform(value: string, transform: string): string | undefined {
  const t = transform.trim();
  if (t === '' || t === 'none') return value;
  switch (t) {
    case 'encodeURIComponent':
      return encodeURIComponent(value);
    case 'toString':
      return String(value);
    case 'parseInt':
      return String(parseInt(value, 10));
    case 'toLowerCase':
      return value.toLowerCase();
    default:
      // Unrecognized transform names are treated as identity (pass-through)
      return value;
  }
}

const _handler: FunctionalConceptHandler = {

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  create(input: Record<string, unknown>): StorageProgram<Result> {
    const bindingId      = input.binding as string;
    const name           = (input.name as string) ?? '';
    const scopeRef       = input.scopeRef as string;
    const sourceKind     = input.sourceKind as string;
    const sourceExpr     = input.sourceExpression as string;
    const targetKind     = input.targetKind as string;
    const targetExpr     = input.targetExpression as string;
    const triggerEvent   = input.triggerEvent as string;
    const transformExpr  = (input.transformExpression as string | null | undefined) ?? null;

    // Input validation — must run before any storage ops
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!VALID_SOURCE_KINDS.has(sourceKind)) {
      return complete(createProgram(), 'invalid', {
        message: `sourceKind must be one of: ${[...VALID_SOURCE_KINDS].join(', ')}`,
      }) as StorageProgram<Result>;
    }
    if (!VALID_TARGET_KINDS.has(targetKind)) {
      return complete(createProgram(), 'invalid', {
        message: `targetKind must be one of: ${[...VALID_TARGET_KINDS].join(', ')}`,
      }) as StorageProgram<Result>;
    }
    if (!VALID_TRIGGER_EVENTS.has(triggerEvent)) {
      return complete(createProgram(), 'invalid', {
        message: `triggerEvent must be one of: ${[...VALID_TRIGGER_EVENTS].join(', ')}`,
      }) as StorageProgram<Result>;
    }
    if (!sourceExpr || sourceExpr.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'sourceExpression is required' }) as StorageProgram<Result>;
    }
    if (!targetExpr || targetExpr.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'targetExpression is required' }) as StorageProgram<Result>;
    }

    // Uniqueness check: a binding with the same (name, scopeRef) must not exist
    const uniquenessKey = `${scopeRef}::${name}`;
    let p = createProgram();
    p = get(p, 'paramBindingIndex', uniquenessKey, 'existing');

    return branch(p,
      (b) => b.existing != null,
      (dupP) => complete(dupP, 'duplicate', {
        message: `A binding named "${name}" already exists in scope "${scopeRef}"`,
      }),
      (okP) => {
        // Store the binding record
        let p2 = put(okP, 'paramBinding', bindingId, {
          binding: bindingId,
          name,
          scopeRef,
          sourceKind,
          sourceExpression: sourceExpr,
          targetKind,
          targetExpression: targetExpr,
          triggerEvent,
          transformExpression: transformExpr,
        } as ParamBindingRecord);
        // Store uniqueness index entry
        p2 = put(p2, 'paramBindingIndex', uniquenessKey, { bindingId });
        return complete(p2, 'ok', { binding: bindingId });
      },
    ) as StorageProgram<Result>;
  },

  // -----------------------------------------------------------------------
  // resolve
  // -----------------------------------------------------------------------
  resolve(input: Record<string, unknown>): StorageProgram<Result> {
    const bindingId = input.binding as string;
    const dataStr   = input.data as string;

    let p = createProgram();
    p = get(p, 'paramBinding', bindingId, 'record');

    return branch(p,
      (b) => b.record == null,
      (nfP) => complete(nfP, 'notfound', { message: `No binding exists with id "${bindingId}"` }),
      (foundP) => {
        // Evaluate the source expression against the JSON data
        const withEval = mapBindings(foundP, (b) => {
          const rec = b.record as ParamBindingRecord;

          // Safely parse JSON data
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            return { error: 'Data is not valid JSON', value: null };
          }

          const raw = evaluatePath(parsed, rec.sourceExpression);
          if (raw == null) {
            return { error: `Source expression "${rec.sourceExpression}" resolved to null/undefined`, value: null };
          }

          const strValue = String(raw);

          // Apply transform if present and non-empty
          const transform = rec.transformExpression;
          if (transform && transform.trim() !== '') {
            const transformed = applyTransform(strValue, transform);
            return { error: null, value: transformed };
          }

          return { error: null, value: strValue };
        }, 'evalResult');

        return branch(withEval,
          (b) => {
            const r = b.evalResult as Record<string, unknown>;
            return r.error != null;
          },
          (invalidP) => completeFrom(invalidP, 'invalid', (b) => {
            const r = b.evalResult as Record<string, unknown>;
            return { message: r.error as string };
          }),
          (okP) => completeFrom(okP, 'ok', (b) => {
            const r = b.evalResult as Record<string, unknown>;
            return { binding: bindingId, resolvedValue: r.value as string };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  // -----------------------------------------------------------------------
  // buildTarget
  // -----------------------------------------------------------------------
  buildTarget(input: Record<string, unknown>): StorageProgram<Result> {
    const bindingId    = input.binding as string;
    const resolvedValue = input.resolvedValue as string;

    let p = createProgram();
    p = get(p, 'paramBinding', bindingId, 'record');

    return branch(p,
      (b) => b.record == null,
      (nfP) => complete(nfP, 'notfound', { message: `No binding exists with id "${bindingId}"` }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const rec = b.record as ParamBindingRecord;
        let target: string;
        if (rec.targetKind === 'navigate') {
          // Replace {value} placeholder with the resolved value
          target = rec.targetExpression.replace('{value}', resolvedValue);
        } else {
          // For all other target kinds, return targetExpression and resolvedValue as-is
          target = rec.targetExpression;
        }
        return { binding: bindingId, target, targetKind: rec.targetKind };
      }),
    ) as StorageProgram<Result>;
  },

  // -----------------------------------------------------------------------
  // get
  // -----------------------------------------------------------------------
  get(input: Record<string, unknown>): StorageProgram<Result> {
    const bindingId = input.binding as string;

    let p = createProgram();
    p = get(p, 'paramBinding', bindingId, 'record');

    return branch(p,
      (b) => b.record == null,
      (nfP) => complete(nfP, 'notfound', { message: `No binding exists with id "${bindingId}"` }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const rec = b.record as ParamBindingRecord;
        return {
          binding: rec.binding,
          name: rec.name,
          scopeRef: rec.scopeRef,
          sourceKind: rec.sourceKind,
          sourceExpression: rec.sourceExpression,
          targetKind: rec.targetKind,
          targetExpression: rec.targetExpression,
          triggerEvent: rec.triggerEvent,
          transformExpression: rec.transformExpression,
        };
      }),
    ) as StorageProgram<Result>;
  },

  // -----------------------------------------------------------------------
  // listForScope
  // -----------------------------------------------------------------------
  listForScope(input: Record<string, unknown>): StorageProgram<Result> {
    const scopeRef = input.scopeRef as string;

    let p = createProgram();
    p = find(p, 'paramBinding', {}, 'all');

    return completeFrom(p, 'ok', (b) => {
      const all = b.all as ParamBindingRecord[];
      const filtered = all
        .filter(rec => rec.scopeRef === scopeRef)
        .map(rec => ({
          binding: rec.binding,
          name: rec.name,
          sourceKind: rec.sourceKind,
          targetKind: rec.targetKind,
          triggerEvent: rec.triggerEvent,
        }));
      return { bindings: filtered };
    }) as StorageProgram<Result>;
  },

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  delete(input: Record<string, unknown>): StorageProgram<Result> {
    const bindingId = input.binding as string;

    let p = createProgram();
    p = get(p, 'paramBinding', bindingId, 'record');

    return branch(p,
      (b) => b.record == null,
      (nfP) => complete(nfP, 'notfound', { message: `No binding exists with id "${bindingId}"` }),
      (foundP) => {
        // Remove the binding record
        let p2 = del(foundP, 'paramBinding', bindingId);
        // Delete the uniqueness index entry using delFrom (dynamic key derived from bound record)
        p2 = delFrom(p2, 'paramBindingIndex', (b) => {
          const rec = b.record as ParamBindingRecord;
          return `${rec.scopeRef}::${rec.name}`;
        });
        return complete(p2, 'ok', { binding: bindingId });
      },
    ) as StorageProgram<Result>;
  },

  // -----------------------------------------------------------------------
  // register — returns the exact PascalCase concept name
  // -----------------------------------------------------------------------
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'ParamBinding' }) as StorageProgram<Result>;
  },
};

// -----------------------------------------------------------------------
// VariableProgram integration
//
// Maps a ParamBinding source kind + sourceExpression to a canonical
// VariableProgram expression string. Returns null for source kinds
// that have no VariableProgram equivalent (e.g. "literal").
// -----------------------------------------------------------------------

function toVariableProgramExpression(sourceKind: string, sourceExpression: string): string | null {
  switch (sourceKind) {
    // field  → $page.{field}
    case 'field':
      return `$page.${sourceExpression}`;
    // url-param → $url.{name}
    case 'url-param':
      return `$url.${sourceExpression}`;
    // relation → $page.{relation} (follow traversal on the current page)
    case 'relation':
      return `$page.${sourceExpression}`;
    // control → $ctx.{controlKey}
    case 'control':
      return `$ctx.${sourceExpression}`;
    default:
      // literal and unknown source kinds — no VP mapping
      return null;
  }
}

/**
 * Try to resolve a binding's source expression through VariableProgram.
 * Returns the resolved string value on success, or null if VariableProgram
 * cannot fully resolve the expression (provider missing, parse error, etc.)
 * so that the caller can fall back to inline resolution.
 */
async function tryVariableProgramResolve(
  rec: ParamBindingRecord,
  dataStr: string,
): Promise<string | null> {
  const expression = toVariableProgramExpression(rec.sourceKind, rec.sourceExpression);
  if (expression === null) return null;

  // Use a fresh scratch storage for the VariableProgram session.
  // parse() stores the program record; resolve() reads it back.
  const vpStorage: ConceptStorage = createInMemoryStorage();

  // Step 1 — parse the expression into a VariableProgram
  let parseResult: Record<string, unknown>;
  try {
    parseResult = await (variableProgramHandler as Record<string, Function>).parse(
      { expression },
      vpStorage,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!parseResult || parseResult.variant !== 'ok') {
    // parse_error or unexpected variant — fall back
    return null;
  }

  const programId = parseResult.program as string;

  // Step 2 — resolve the program against the data context
  let resolveResult: Record<string, unknown>;
  try {
    resolveResult = await (variableProgramHandler as Record<string, Function>).resolve(
      { program: programId, context: dataStr },
      vpStorage,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!resolveResult || resolveResult.variant !== 'ok') {
    // not_found, type_error, provider_not_found — fall back
    return null;
  }

  const value = resolveResult.value as string;

  // If the value is a platform-dispatch placeholder (provider not yet registered
  // in the scratch storage), treat it as unresolved and fall back.
  if (typeof value === 'string' && (value.startsWith('__provider:') || value.startsWith('__transform:'))) {
    return null;
  }

  return value;
}

// Build the base handler from autoInterpret (all actions functional).
// The resolve action is overridden below with an imperative version that
// routes through VariableProgram before falling back to inline evaluation.
const _baseHandler = autoInterpret(_handler);

// Override resolve() so that when called in imperative compat mode
// (input, storage) it tries VariableProgram first and falls back to the
// original inline evaluation when VP cannot fully resolve the expression.
// When called in functional mode (input only) it delegates to the
// underlying StorageProgram produced by _handler.resolve — preserving
// the functional calling convention.
export const paramBindingHandler = {
  ..._baseHandler,

  resolve(input: Record<string, unknown>, storage?: ConceptStorage) {
    // Functional mode — no storage provided; delegate to the functional program.
    if (storage === undefined) {
      return (_handler as Record<string, Function>).resolve(input);
    }

    // Imperative compat mode — try VariableProgram first, then fall back.
    return resolveImperative(input, storage);
  },
};

async function resolveImperative(
  input: Record<string, unknown>,
  storage: ConceptStorage,
): Promise<Record<string, unknown>> {
  const bindingId = input.binding as string;
  const dataStr   = input.data as string;

  // Fetch the binding record from storage
  const record = await storage.get('paramBinding', bindingId);
  if (!record) {
    return { variant: 'notfound', message: `No binding exists with id "${bindingId}"` };
  }
  const rec = record as unknown as ParamBindingRecord;

  // --- VariableProgram path ---
  let vpValue: string | null = null;
  try {
    vpValue = await tryVariableProgramResolve(rec, dataStr);
  } catch {
    vpValue = null;
  }

  if (vpValue !== null) {
    // Apply transform if present
    const transform = rec.transformExpression;
    if (transform && transform.trim() !== '') {
      const transformed = applyTransform(vpValue, transform);
      if (transformed === undefined) {
        return { variant: 'invalid', message: `Unknown transform "${transform}"` };
      }
      return { variant: 'ok', binding: bindingId, resolvedValue: transformed };
    }
    return { variant: 'ok', binding: bindingId, resolvedValue: vpValue };
  }

  // --- Inline fallback (original logic) ---
  // Safely parse JSON data
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(dataStr) as Record<string, unknown>;
  } catch {
    return { variant: 'invalid', message: 'Data is not valid JSON' };
  }

  const raw = evaluatePath(parsed, rec.sourceExpression);
  if (raw == null) {
    return {
      variant: 'invalid',
      message: `Source expression "${rec.sourceExpression}" resolved to null/undefined`,
    };
  }

  const strValue = String(raw);

  // Apply transform if present
  const transform = rec.transformExpression;
  if (transform && transform.trim() !== '') {
    const transformed = applyTransform(strValue, transform);
    if (transformed === undefined) {
      return { variant: 'invalid', message: `Unknown transform "${transform}"` };
    }
    return { variant: 'ok', binding: bindingId, resolvedValue: transformed };
  }

  return { variant: 'ok', binding: bindingId, resolvedValue: strValue };
}
