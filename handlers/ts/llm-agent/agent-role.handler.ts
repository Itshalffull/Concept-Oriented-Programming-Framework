// @clef-handler style=functional
// AgentRole Concept Implementation
// Capability declaration for agents enabling task-agent matching in
// multi-agent systems. Tracks performance history per task type for
// weighted delegation via Contract Net protocols.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `agent-role-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'AgentRole' }) as StorageProgram<Result>;
  },

  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const capabilities = input.capabilities as Array<{ task_type: string; proficiency: number }>;
    const constraints = input.constraints as {
      max_concurrent: number;
      required_tools: string[];
      expertise_domains: string[];
    };

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'capabilities are required and must be non-empty' }) as StorageProgram<Result>;
    }
    for (const cap of capabilities) {
      if (cap.proficiency < 0.0 || cap.proficiency > 1.0) {
        return complete(createProgram(), 'invalid', { message: `Proficiency must be 0.0-1.0, got ${cap.proficiency}` }) as StorageProgram<Result>;
      }
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'role', id, {
      id,
      name,
      capabilities,
      constraints: constraints || { max_concurrent: 1, required_tools: [], expertise_domains: [] },
      current_load: 0,
      performance: [],
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { role: id }) as StorageProgram<Result>;
  },

  bid(input: Record<string, unknown>) {
    const role = input.role as string;
    const taskDescription = input.task_description as string;
    const taskType = input.task_type as string;

    if (!role || (role as string).trim() === '') {
      return complete(createProgram(), 'decline', { reason: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'decline', { reason: 'Role not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', role, 'roleData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.roleData as Record<string, unknown>;
          const caps = data.capabilities as Array<{ task_type: string; proficiency: number }>;
          const constraints = data.constraints as { max_concurrent: number };
          const currentLoad = data.current_load as number;

          const matchingCap = caps.find(c => c.task_type === taskType);
          if (!matchingCap) {
            return { _noMatch: true } as unknown as Record<string, unknown>;
          }

          const loadFactor = 1 - (currentLoad / constraints.max_concurrent);
          const estimatedQuality = matchingCap.proficiency * Math.max(0.1, loadFactor);

          return {
            bid: {
              role,
              estimated_quality: estimatedQuality,
              estimated_latency_ms: Math.round(1000 / Math.max(0.1, estimatedQuality)),
              estimated_cost: 0.01 * (1 / Math.max(0.1, estimatedQuality)),
            },
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  match(input: Record<string, unknown>) {
    const taskType = input.task_type as string;

    if (!taskType || taskType.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No role handles this task type' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'role', {}, 'allRoles');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allRoles || []) as Array<Record<string, unknown>>;

      const matching = all
        .map(r => {
          const caps = r.capabilities as Array<{ task_type: string; proficiency: number }>;
          const perf = (r.performance || []) as Array<{ task_type: string; success_rate: number }>;
          const cap = caps.find(c => c.task_type === taskType);
          if (!cap) return null;

          const perfRecord = perf.find(p => p.task_type === taskType);
          const successRate = perfRecord ? perfRecord.success_rate : 0.5;
          const constraints = r.constraints as { max_concurrent: number };
          const loadFactor = 1 - ((r.current_load as number) / constraints.max_concurrent);
          const score = successRate * cap.proficiency * Math.max(0.1, loadFactor);

          return { role: r.id as string, score };
        })
        .filter(Boolean) as Array<{ role: string; score: number }>;

      if (matching.length === 0) {
        return { message: 'No role handles this task type' };
      }

      matching.sort((a, b) => b.score - a.score);
      return { ranked: matching };
    }) as StorageProgram<Result>;
  },

  recordOutcome(input: Record<string, unknown>) {
    const role = input.role as string;
    const taskType = input.task_type as string;
    const success = input.success as boolean;
    const latencyMs = input.latency_ms as number;
    const cost = input.cost as number;

    if (!role || (role as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Role not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', role, 'roleData');
        b = putFrom(b, 'role', role, (bindings) => {
          const data = bindings.roleData as Record<string, unknown>;
          const performance = [...((data.performance || []) as Array<Record<string, unknown>>)];

          const existingIdx = performance.findIndex(p => p.task_type === taskType);
          if (existingIdx >= 0) {
            const existing = performance[existingIdx];
            const total = (existing.total_tasks as number) + 1;
            const successCount = (existing.success_rate as number) * (existing.total_tasks as number) + (success ? 1 : 0);
            performance[existingIdx] = {
              task_type: taskType,
              success_rate: successCount / total,
              avg_latency_ms: ((existing.avg_latency_ms as number) * (existing.total_tasks as number) + latencyMs) / total,
              avg_cost: ((existing.avg_cost as number) * (existing.total_tasks as number) + cost) / total,
              total_tasks: total,
            };
          } else {
            performance.push({
              task_type: taskType,
              success_rate: success ? 1.0 : 0.0,
              avg_latency_ms: latencyMs,
              avg_cost: cost,
              total_tasks: 1,
            });
          }

          return { ...data, performance };
        });
        return complete(b, 'ok', { role });
      })(),
    ) as StorageProgram<Result>;
  },

  getAvailability(input: Record<string, unknown>) {
    const role = input.role as string;

    if (!role || (role as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'role is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'role', role, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Role not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'role', role, 'roleData');
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.roleData as Record<string, unknown>;
          const constraints = data.constraints as { max_concurrent: number };
          const currentLoad = data.current_load as number;
          return {
            available: currentLoad < constraints.max_concurrent,
            current_load: currentLoad,
            max: constraints.max_concurrent,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const agentRoleHandler = autoInterpret(_handler);
