// RegoEvaluator Policy Provider
// Structured rule evaluation with data lookups and path-based resolution (OPA-inspired).
import type { ConceptHandler } from '@clef/runtime';

interface RegoRule {
  name: string;
  default?: unknown;
  body: Array<{ op: string; path: string; value?: unknown; dataPath?: string }>;
}

function resolvePath(path: string, obj: Record<string, unknown>): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateBody(
  body: RegoRule['body'],
  input: Record<string, unknown>,
  data: Record<string, unknown>,
): boolean {
  for (const clause of body) {
    const resolved = clause.path.startsWith('data.')
      ? resolvePath(clause.path.slice(5), data)
      : resolvePath(clause.path, input);

    switch (clause.op) {
      case 'eq':
        if (resolved !== (clause.dataPath ? resolvePath(clause.dataPath, data) : clause.value)) return false;
        break;
      case 'neq':
        if (resolved === clause.value) return false;
        break;
      case 'in': {
        const list = clause.dataPath ? resolvePath(clause.dataPath, data) : clause.value;
        if (!Array.isArray(list) || !list.includes(resolved)) return false;
        break;
      }
      case 'gt':
        if ((resolved as number) <= (clause.value as number)) return false;
        break;
      case 'gte':
        if ((resolved as number) < (clause.value as number)) return false;
        break;
      case 'lt':
        if ((resolved as number) >= (clause.value as number)) return false;
        break;
      case 'exists':
        if (resolved === undefined || resolved === null) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

export const regoEvaluatorHandler: ConceptHandler = {
  async loadBundle(input, storage) {
    const id = `rego-${Date.now()}`;
    const rules = typeof input.policySource === 'string'
      ? JSON.parse(input.policySource)
      : input.policySource;
    const data = typeof input.dataSource === 'string'
      ? JSON.parse(input.dataSource)
      : input.dataSource ?? {};

    await storage.put('rego', id, {
      id,
      rules: JSON.stringify(rules),
      data: JSON.stringify(data),
      packageName: input.packageName,
      compiledAt: new Date().toISOString(),
    });

    await storage.put('plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'RegoEvaluator',
      instanceId: id,
    });

    return { variant: 'loaded', bundle: id };
  },

  async evaluate(input, storage) {
    const { bundle } = input;
    const evalInput = input.input ?? input.evalInput;
    const record = await storage.get('rego', bundle as string);
    if (!record) return { variant: 'not_found', bundle };

    const rules = JSON.parse(record.rules as string) as RegoRule[];
    const data = JSON.parse(record.data as string) as Record<string, unknown>;
    const ctx = (typeof evalInput === 'string' ? JSON.parse(evalInput) : evalInput ?? {}) as Record<string, unknown>;

    const bindings: Record<string, unknown> = {};
    let decision = 'deny';

    for (const rule of rules) {
      const result = evaluateBody(rule.body, ctx, data);
      bindings[rule.name] = result;
      if (rule.name === 'allow' && result) decision = 'allow';
    }

    return { variant: 'result', decision, bindings: JSON.stringify(bindings) };
  },

  async updateData(input, storage) {
    const { bundle, newData } = input;
    const record = await storage.get('rego', bundle as string);
    if (!record) return { variant: 'not_found', bundle };

    const existingData = JSON.parse(record.data as string) as Record<string, unknown>;
    const update = (typeof newData === 'string' ? JSON.parse(newData) : newData) as Record<string, unknown>;
    const merged = { ...existingData, ...update };

    await storage.put('rego', bundle as string, { ...record, data: JSON.stringify(merged) });
    return { variant: 'updated', bundle };
  },
};
