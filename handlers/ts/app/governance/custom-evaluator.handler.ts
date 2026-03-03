// CustomEvaluator Policy Provider
// Evaluate JSON predicate trees against a context object.
import type { ConceptHandler } from '@clef/runtime';

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

export const customEvaluatorHandler: ConceptHandler = {
  async register(input, storage) {
    const id = `custom-${Date.now()}`;
    const source = typeof input.source === 'string' ? JSON.parse(input.source) : input.source;
    await storage.put('custom_eval', id, {
      id,
      name: input.name,
      predicateTree: source,
      language: input.language ?? 'predicate-tree',
      sandbox: input.sandbox ?? true,
    });

    await storage.put('plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'CustomEvaluator',
      instanceId: id,
    });

    return { variant: 'registered', evaluator: id };
  },

  async evaluate(input, storage) {
    const { evaluator, context } = input;
    const record = await storage.get('custom_eval', evaluator as string);
    if (!record) return { variant: 'not_found', evaluator };

    const tree = record.predicateTree as Record<string, unknown>;
    const ctx = (typeof context === 'string' ? JSON.parse(context) : context) as Record<string, unknown>;

    const result = evaluatePredicate(tree, ctx);
    return { variant: 'result', evaluator, output: result, decision: result ? 'allow' : 'deny' };
  },

  async deregister(input, storage) {
    const { evaluator } = input;
    await storage.del('custom_eval', evaluator as string);
    return { variant: 'deregistered', evaluator };
  },
};
