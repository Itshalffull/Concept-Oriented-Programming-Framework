// @clef-handler style=functional concept=RemoteQueryProvider
// RemoteQueryProvider Concept Implementation — Functional (StorageProgram) style
//
// Manages remote query providers that execute query programs against external
// APIs. Handles pushdown planning (splitting instructions into those the remote
// API can handle natively vs in-memory residual), and executes HTTP calls via
// the perform() instruction for full observability (ConnectorCall, RetryPolicy,
// CircuitBreaker, etc.). In-memory residual filtering uses the evaluateFilterNode
// pattern from QueryExecution.
//
// See architecture doc Section 10.1 for StorageProgram monad patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings, performFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── FilterNode evaluator (matches TextDslProvider's FilterNode type) ─────────
// Reused from query-execution.handler.ts for residual in-memory filtering.

function evaluateFilterNode(node: Record<string, unknown>, record: Record<string, unknown>): boolean {
  const nodeType = node.type as string;
  switch (nodeType) {
    case 'true': return true;
    case 'false': return false;
    case 'eq': return String(record[node.field as string] ?? '') === String(node.value);
    case 'neq': return String(record[node.field as string] ?? '') !== String(node.value);
    case 'gt': return String(record[node.field as string] ?? '') > String(node.value);
    case 'gte': return String(record[node.field as string] ?? '') >= String(node.value);
    case 'lt': return String(record[node.field as string] ?? '') < String(node.value);
    case 'lte': return String(record[node.field as string] ?? '') <= String(node.value);
    case 'in': {
      const values = (node.values as unknown[]) ?? [];
      const fieldVal = String(record[node.field as string] ?? '');
      return values.some(v => String(v) === fieldVal);
    }
    case 'not_in': {
      const values = (node.values as unknown[]) ?? [];
      const fieldVal = String(record[node.field as string] ?? '');
      return !values.some(v => String(v) === fieldVal);
    }
    case 'exists': return record[node.field as string] != null;
    case 'function': {
      const fieldVal = String(record[node.field as string] ?? '');
      const searchVal = String(node.value ?? '');
      switch (node.name as string) {
        case 'contains': return fieldVal.toLowerCase().includes(searchVal.toLowerCase());
        case 'startsWith': return fieldVal.startsWith(searchVal);
        case 'endsWith': return fieldVal.endsWith(searchVal);
        case 'matches': return new RegExp(searchVal).test(fieldVal);
        default: return true;
      }
    }
    case 'and': {
      const conditions = (node.conditions as Array<Record<string, unknown>>) ?? [];
      return conditions.every(c => evaluateFilterNode(c, record));
    }
    case 'or': {
      const conditions = (node.conditions as Array<Record<string, unknown>>) ?? [];
      return conditions.some(c => evaluateFilterNode(c, record));
    }
    case 'not':
      return !evaluateFilterNode(node.condition as Record<string, unknown>, record);
    default: return true;
  }
}

// ─── Pushdown planning helpers ────────────────────────────────────────────────

interface PushdownPlan {
  pushdownInstructions: Array<Record<string, unknown>>;
  residualInstructions: Array<Record<string, unknown>>;
  apiParams: Record<string, unknown>;
}

/**
 * Split instructions into pushdown (API-native) vs residual (in-memory).
 * Also maps filter/sort/limit instructions to API query params.
 */
function planPushdownInstructions(
  instructions: Array<Record<string, unknown>>,
  pushdownOpsSet: Set<string>,
): PushdownPlan {
  const pushdownInstructions: Array<Record<string, unknown>> = [];
  const residualInstructions: Array<Record<string, unknown>> = [];
  const apiParams: Record<string, unknown> = {};

  for (const instr of instructions) {
    const instrType = (instr.type as string) ?? '';

    // scan is always "pushdown" (it's the base fetch from the API)
    if (instrType === 'scan') {
      pushdownInstructions.push(instr);
      if (instr.source) {
        apiParams['resource'] = instr.source;
      }
      continue;
    }

    if (pushdownOpsSet.has(instrType)) {
      pushdownInstructions.push(instr);

      // Map instruction to API query params
      if (instrType === 'filter') {
        const node = typeof instr.node === 'string'
          ? JSON.parse(instr.node) as Record<string, unknown>
          : instr.node as Record<string, unknown>;
        if (node && node.type === 'eq' && node.field && node.value !== undefined) {
          // eq field=value becomes ?field=value
          apiParams[node.field as string] = node.value;
        }
      } else if (instrType === 'sort') {
        const keys = typeof instr.keys === 'string'
          ? JSON.parse(instr.keys) as Array<{ field: string; direction: string }>
          : (instr.keys as Array<{ field: string; direction: string }> ?? []);
        if (keys.length > 0) {
          // Map first sort key to ?sort=field:direction
          const firstKey = keys[0];
          apiParams['sort'] = `${firstKey.field}:${firstKey.direction}`;
        }
      } else if (instrType === 'limit') {
        apiParams['limit'] = instr.count;
      } else if (instrType === 'offset') {
        apiParams['offset'] = instr.count;
      }
    } else {
      residualInstructions.push(instr);
    }
  }

  return { pushdownInstructions, residualInstructions, apiParams };
}

/**
 * Apply residual instructions in-memory against a list of records.
 */
function applyResidualInstructions(
  records: Array<Record<string, unknown>>,
  residualInstructions: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  let currentSet = [...records];

  for (const instr of residualInstructions) {
    const instrType = (instr.type as string) ?? '';

    switch (instrType) {
      case 'filter': {
        const node = typeof instr.node === 'string'
          ? JSON.parse(instr.node) as Record<string, unknown>
          : instr.node as Record<string, unknown>;
        currentSet = currentSet.filter(record => evaluateFilterNode(node, record));
        break;
      }
      case 'sort': {
        const keys = typeof instr.keys === 'string'
          ? JSON.parse(instr.keys) as Array<{ field: string; direction: string }>
          : (instr.keys as Array<{ field: string; direction: string }> ?? []);
        currentSet = [...currentSet];
        for (const key of [...keys].reverse()) {
          const desc = key.direction === 'desc';
          currentSet.sort((a, b) => {
            const aVal = a[key.field];
            const bVal = b[key.field];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return desc ? 1 : -1;
            if (bVal == null) return desc ? -1 : 1;
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        break;
      }
      case 'limit': {
        const count = typeof instr.count === 'number'
          ? instr.count
          : parseInt(String(instr.count ?? '0'), 10);
        currentSet = currentSet.slice(0, count);
        break;
      }
      case 'offset': {
        const count = typeof instr.count === 'number'
          ? instr.count
          : parseInt(String(instr.count ?? '0'), 10);
        currentSet = currentSet.slice(count);
        break;
      }
      case 'project': {
        const fields = typeof instr.fields === 'string'
          ? JSON.parse(instr.fields) as string[]
          : (instr.fields as string[] ?? []);
        currentSet = currentSet.map(record => {
          const projected: Record<string, unknown> = {};
          for (const f of fields) {
            if (f in record) projected[f] = record[f];
          }
          return projected;
        });
        break;
      }
      default:
        // Unknown residual instruction — skip
        break;
    }
  }

  return currentSet;
}

// ─── Provider record type ─────────────────────────────────────────────────────

type ProviderRecord = {
  provider: string;
  name: string;
  source: string;
  manifestRef: string;
  projectionRef: string;
  pushdownOps: string[];
};

// ─── Handler ──────────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const source = input.source as string;
    const manifestRef = (input.manifestRef ?? '') as string;
    const projectionRef = (input.projectionRef ?? '') as string;
    const pushdownOpsRaw = (input.pushdownOps ?? '[]') as string;

    // Input validation — must happen before any storage operations
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!source || (typeof source === 'string' && source.trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'source is required' }) as StorageProgram<Result>;
    }

    // Validate pushdownOps is a valid JSON array
    let parsedPushdownOps: string[];
    try {
      const parsed = JSON.parse(typeof pushdownOpsRaw === 'string' ? pushdownOpsRaw : '[]');
      if (!Array.isArray(parsed)) {
        return complete(createProgram(), 'invalid', { message: 'pushdownOps must be a JSON array' }) as StorageProgram<Result>;
      }
      parsedPushdownOps = parsed;
    } catch {
      return complete(createProgram(), 'invalid', { message: 'pushdownOps is not valid JSON' }) as StorageProgram<Result>;
    }

    const ops = parsedPushdownOps;

    let p = createProgram();
    p = get(p, 'remoteProvider', name, 'existing');

    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { message: `A provider with name "${name}" already exists` }),
      (b) => {
        const b2 = put(b, 'remoteProvider', name, {
          provider: name,
          name,
          source,
          manifestRef,
          projectionRef,
          pushdownOps: ops,
        } as ProviderRecord);
        return complete(b2, 'ok', { provider: name });
      },
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const providerKey = input.provider as string;
    const programRaw = (input.program ?? '{}') as string;

    let p = createProgram();
    p = get(p, 'remoteProvider', providerKey, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'notfound', { message: `No provider exists with identifier "${providerKey}"` }),
      (b) => {
        // Parse the program JSON
        const parseResult = mapBindings(b, (_bindings) => {
          try {
            const parsed = JSON.parse(typeof programRaw === 'string' ? programRaw : '{}') as Record<string, unknown>;
            const instructions: Array<Record<string, unknown>> = Array.isArray(parsed.instructions)
              ? parsed.instructions
              : [];
            return { ok: true, parsed, instructions };
          } catch {
            return { ok: false, message: 'program is not valid JSON' };
          }
        }, '_parseResult');

        return branch(parseResult,
          (bb) => !(bb._parseResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseResult as { ok: false; message: string }).message,
          })),
          (bb) => {
            // Build the pushdown plan from provider capabilities
            const planned = mapBindings(bb, (bindings) => {
              const record = bindings.providerRecord as ProviderRecord;
              const parseRes = bindings._parseResult as { ok: true; instructions: Array<Record<string, unknown>> };
              const instructions = parseRes.instructions;
              const pushdownOpsSet = new Set(record.pushdownOps ?? []);
              return planPushdownInstructions(instructions, pushdownOpsSet);
            }, '_plan');

            // Issue HTTP GET to the remote API endpoint using performFrom()
            // The provider's source is used as the endpoint identifier.
            // API params from pushdown planning are passed as query params.
            const withHttpCall = performFrom(planned, 'http', 'GET', (bindings) => {
              const record = bindings.providerRecord as ProviderRecord;
              const plan = bindings._plan as PushdownPlan;
              return {
                endpoint: record.source,
                method: 'GET',
                params: plan.apiParams,
              };
            }, '_httpResponse');

            // Apply residual instructions in-memory and return results
            return completeFrom(withHttpCall, 'ok', (bindings) => {
              const plan = bindings._plan as PushdownPlan;
              const httpResponse = bindings._httpResponse as { body?: unknown; data?: unknown } | null;

              // Parse response rows from HTTP call (fallback to empty if no real HTTP was made)
              let remoteRows: Array<Record<string, unknown>> = [];
              if (httpResponse) {
                const responseData = httpResponse.body ?? httpResponse.data ?? httpResponse;
                if (Array.isArray(responseData)) {
                  remoteRows = responseData as Array<Record<string, unknown>>;
                } else if (typeof responseData === 'string') {
                  try {
                    const parsed = JSON.parse(responseData);
                    remoteRows = Array.isArray(parsed) ? parsed : [];
                  } catch {
                    remoteRows = [];
                  }
                }
              }

              // Apply residual in-memory instructions
              const finalRows = applyResidualInstructions(remoteRows, plan.residualInstructions);

              const record = bindings.providerRecord as ProviderRecord;
              return {
                rows: JSON.stringify(finalRows),
                metadata: JSON.stringify({
                  source: record.source,
                  pushdownCount: plan.pushdownInstructions.length,
                  residualCount: plan.residualInstructions.length,
                  apiParams: plan.apiParams,
                }),
              };
            });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  planPushdown(input: Record<string, unknown>) {
    const providerKey = input.provider as string;
    const programRaw = (input.program ?? '{}') as string;

    let p = createProgram();
    p = get(p, 'remoteProvider', providerKey, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'notfound', { message: `No provider exists with identifier "${providerKey}"` }),
      (b) => {
        const parseResult = mapBindings(b, (_bindings) => {
          try {
            const parsed = JSON.parse(typeof programRaw === 'string' ? programRaw : '{}') as Record<string, unknown>;
            const instructions: Array<Record<string, unknown>> = Array.isArray(parsed.instructions)
              ? parsed.instructions
              : [];
            return { ok: true, instructions };
          } catch {
            return { ok: false, message: 'program is not valid JSON' };
          }
        }, '_parseResult');

        return branch(parseResult,
          (bb) => !(bb._parseResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseResult as { ok: false; message: string }).message,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => {
            const record = bindings.providerRecord as ProviderRecord;
            const parseRes = bindings._parseResult as { ok: true; instructions: Array<Record<string, unknown>> };
            const instructions = parseRes.instructions;
            const pushdownOpsSet = new Set(record.pushdownOps ?? []);
            const plan = planPushdownInstructions(instructions, pushdownOpsSet);

            return {
              pushdown: JSON.stringify({ instructions: plan.pushdownInstructions }),
              residual: JSON.stringify({ instructions: plan.residualInstructions }),
              apiParams: JSON.stringify(plan.apiParams),
            };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const providerKey = input.provider as string;

    let p = createProgram();
    p = get(p, 'remoteProvider', providerKey, 'providerRecord');

    return branch(p,
      (b) => b.providerRecord == null,
      (b) => complete(b, 'notfound', { message: `No provider exists with identifier "${providerKey}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.providerRecord as ProviderRecord;
        return {
          provider: record.provider,
          name: record.name,
          source: record.source,
          manifestRef: record.manifestRef,
          projectionRef: record.projectionRef,
          pushdownOps: JSON.stringify(record.pushdownOps ?? []),
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'remoteProvider', {}, 'allProviders');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allProviders ?? []) as Array<ProviderRecord>;
      const providers = all.map(r => ({
        provider: r.provider,
        name: r.name,
        source: r.source,
      }));
      return { providers };
    }) as StorageProgram<Result>;
  },

};

export const remoteQueryProviderHandler = autoInterpret(_handler);
