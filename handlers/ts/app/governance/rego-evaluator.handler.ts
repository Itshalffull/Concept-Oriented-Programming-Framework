// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// RegoEvaluator Policy Provider
// Structured rule evaluation with data lookups and path-based resolution (OPA-inspired).
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _regoEvaluatorHandler: FunctionalConceptHandler = {
  loadBundle(input: Record<string, unknown>) {
    if (!input.policySource || (typeof input.policySource === 'string' && (input.policySource as string).trim() === '')) {
      return complete(createProgram(), 'compile_error', { message: 'policySource is required' }) as StorageProgram<Result>;
    }
    const id = `rego-${Date.now()}`;
    const rules = typeof input.policySource === 'string'
      ? JSON.parse(input.policySource)
      : input.policySource;
    const data = typeof input.dataSource === 'string'
      ? JSON.parse(input.dataSource)
      : input.dataSource ?? {};

    let p = createProgram();
    p = put(p, 'rego', id, {
      id,
      rules: JSON.stringify(rules),
      data: JSON.stringify(data),
      packageName: input.packageName,
      compiledAt: new Date().toISOString(),
    });
    p = put(p, 'plugin-registry', `policy-evaluator:${id}`, {
      id: `policy-evaluator:${id}`,
      pluginKind: 'policy-evaluator',
      provider: 'RegoEvaluator',
      instanceId: id,
    });
    return complete(p, 'ok', { bundle: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const { bundle } = input;
    const evalInput = input.input ?? input.evalInput;
    let p = createProgram();
    p = get(p, 'rego', bundle as string, 'record');

    p = branch(p, 'record',
      (b) => {
        return completeFrom(b, 'result', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const rules = JSON.parse(record.rules as string) as RegoRule[];
          const data = JSON.parse(record.data as string) as Record<string, unknown>;
          const ctx = (typeof evalInput === 'string' ? JSON.parse(evalInput as string) : evalInput ?? {}) as Record<string, unknown>;

          const ruleBindings: Record<string, unknown> = {};
          let decision = 'deny';

          for (const rule of rules) {
            const result = evaluateBody(rule.body, ctx, data);
            ruleBindings[rule.name] = result;
            if (rule.name === 'allow' && result) decision = 'allow';
          }

          return { decision, bindings: JSON.stringify(ruleBindings) };
        });
      },
      (b) => complete(b, 'not_found', { bundle }),
    );

    return p as StorageProgram<Result>;
  },

  updateData(input: Record<string, unknown>) {
    const { bundle, newData } = input;
    let p = createProgram();
    p = get(p, 'rego', bundle as string, 'record');

    p = branch(p, 'record',
      (b) => {
        b = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const existingData = JSON.parse(record.data as string) as Record<string, unknown>;
          const update = (typeof newData === 'string' ? JSON.parse(newData as string) : newData) as Record<string, unknown>;
          return JSON.stringify({ ...existingData, ...update });
        }, 'mergedData');

        let b2 = putFrom(b, 'rego', bundle as string, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const mergedData = bindings.mergedData as string;
          return { ...record, data: mergedData };
        });
        return complete(b2, 'ok', { bundle });
      },
      (b) => complete(b, 'not_found', { bundle }),
    );

    return p as StorageProgram<Result>;
  },
};

export const regoEvaluatorHandler = autoInterpret(_regoEvaluatorHandler);
