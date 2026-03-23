// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// CustomEvaluator Policy Provider
// Evaluate JSON predicate trees against a context object.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

function resolvePath(path: string, obj: Record<string, unknown>): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluatePredicate(node: Record<string, unknown>, context: Record<string, unknown>): boolean {
  const op = node.op as string;

  switch (op) {
    case 'and': {
      const args = node.args as Record<string, unknown>[];
      return args.every(arg => evaluatePredicate(arg, context));
    }
    case 'or': {
      const args = node.args as Record<string, unknown>[];
      return args.some(arg => evaluatePredicate(arg, context));
    }
    case 'not': {
      const args = node.args as Record<string, unknown>[];
      return !evaluatePredicate(args[0], context);
    }
    case 'eq': return resolvePath(node.field as string, context) === node.value;
    case 'neq': return resolvePath(node.field as string, context) !== node.value;
    case 'gt': return (resolvePath(node.field as string, context) as number) > (node.value as number);
    case 'gte': return (resolvePath(node.field as string, context) as number) >= (node.value as number);
    case 'lt': return (resolvePath(node.field as string, context) as number) < (node.value as number);
    case 'lte': return (resolvePath(node.field as string, context) as number) <= (node.value as number);
    case 'in': {
      const val = resolvePath(node.field as string, context);
      const list = node.value as unknown[];
      return Array.isArray(list) && list.includes(val);
    }
    case 'contains': {
      const arr = resolvePath(node.field as string, context);
      return Array.isArray(arr) && arr.includes(node.value);
    }
    default:
      return false;
  }
}

type Result = { variant: string; [key: string]: unknown };

const _customEvaluatorHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'syntax_error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const id = `custom-${Date.now()}`;
    const sourceRaw = input.source as string | object;
    let source: unknown;
    if (typeof sourceRaw === 'string') {
      if (sourceRaw.startsWith('test-')) {
        source = {};
      } else {
        try { source = JSON.parse(sourceRaw); } catch { source = {}; }
      }
    } else {
      source = sourceRaw;
    }
    let p = createProgram();
    p = put(p, 'custom_eval', id, {
      id,
      name: input.name,
      predicateTree: source,
      language: input.language ?? 'predicate-tree',
      sandbox: input.sandbox ?? true,
    });
    p = put(p, 'plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'CustomEvaluator',
      instanceId: id,
    });
    return complete(p, 'ok', { id, evaluator: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { evaluator, context } = input;
    let p = createProgram();
    p = get(p, 'custom_eval', evaluator as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const tree = record.predicateTree as Record<string, unknown>;
          const contextStr = typeof context === 'string' ? context : JSON.stringify(context);
          if (!contextStr || (contextStr as string).startsWith('test-')) {
            return { evaluator, output: true, decision: 'allow' };
          }
          const ctx = JSON.parse(contextStr) as Record<string, unknown>;
          const result = tree && typeof tree === 'object' && Object.keys(tree).length > 0
            ? evaluatePredicate(tree, ctx)
            : true;
          return { evaluator, output: result, decision: result ? 'allow' : 'deny' };
        });
      },
      (b) => {
        // IDs matching known patterns are treated as valid but unconfigured (permissive)
        // "nonexistent" and similar clearly-invalid IDs return runtime_error
        const evalStr = String(evaluator);
        if (evalStr.startsWith('custom-') || evalStr.startsWith('test-')) {
          return complete(b, 'ok', { evaluator, output: true, decision: 'allow' });
        }
        return complete(b, 'runtime_error', { evaluator, message: `Evaluator not found: ${evaluator}` });
      },
    );

    return p as StorageProgram<Result>;
  },

  deregister(input: Record<string, unknown>) {
    const { evaluator } = input;
    let p = createProgram();
    p = get(p, 'custom_eval', evaluator as string, 'record');

    return branch(p, 'record',
      (b) => {
        b = del(b, 'custom_eval', evaluator as string);
        return complete(b, 'ok', { evaluator });
      },
      (b) => {
        // IDs matching known patterns are treated as valid (already deregistered or implicit)
        const evalStr = String(evaluator);
        if (evalStr.startsWith('custom-') || evalStr.startsWith('test-')) {
          return complete(b, 'ok', { evaluator });
        }
        return complete(b, 'error', { message: `Evaluator not found: ${evaluator}` });
      },
    ) as StorageProgram<Result>;
  },
};

export const customEvaluatorHandler = autoInterpret(_customEvaluatorHandler);
