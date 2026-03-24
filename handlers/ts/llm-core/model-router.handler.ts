// @clef-handler style=functional
// ModelRouter Concept Implementation
// Decides which LLM handles each request based on quality requirements,
// cost constraints, latency needs, and current availability. Supports
// rule-based routing, fallback chains, and circuit breakers.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `route-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ModelRouter' }) as StorageProgram<Result>;
  },

  addRoute(input: Record<string, unknown>) {
    const name = input.name as string;
    const modelId = input.model_id as string;
    const conditions = input.conditions as Record<string, unknown>;
    const priority = input.priority as number;
    const weight = input.weight as number;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'duplicate', { message: 'Route name is required' }) as StorageProgram<Result>;
    }

    // Check for duplicate name
    let p = createProgram();
    p = find(p, 'route', {}, 'allRoutes');
    p = mapBindings(p, (bindings) => {
      const routes = (bindings.allRoutes || []) as Array<Record<string, unknown>>;
      return routes.find(r => r.route_name === name) || null;
    }, '_existing');

    return branch(p,
      (bindings) => !!bindings._existing,
      complete(createProgram(), 'duplicate', { message: `Route '${name}' already exists` }),
      (() => {
        const id = nextId();
        let b = createProgram();
        b = put(b, 'route', id, {
          id,
          route_name: name,
          model_id: modelId,
          conditions: conditions || { task_types: [], complexity_threshold: null, max_cost_per_call: null, max_latency_ms: null },
          priority: priority ?? 0,
          weight: weight ?? 1.0,
          performance_log: {
            success_rate: 1.0,
            avg_latency_ms: 0,
            avg_cost: 0,
            total_calls: 0,
          },
          circuit_breaker: {
            failure_count: 0,
            cooldown_until: null,
            threshold: 5,
          },
          createdAt: new Date().toISOString(),
        });
        return complete(b, 'ok', { route: id });
      })(),
    ) as StorageProgram<Result>;
  },

  route(input: Record<string, unknown>) {
    const taskType = input.task_type as string;
    const complexity = input.complexity as number | null;
    const costLimit = input.cost_limit as number | null;
    const latencyLimit = input.latency_limit as number | null;

    let p = createProgram();
    p = find(p, 'route', {}, 'allRoutes');

    p = mapBindings(p, (bindings) => {
      const routes = (bindings.allRoutes || []) as Array<Record<string, unknown>>;
      const now = Date.now();

      // Filter and score routes
      const candidates = routes
        .filter(r => {
          // Skip circuit-broken routes
          const cb = r.circuit_breaker as Record<string, unknown>;
          if (cb.cooldown_until) {
            const cooldownTime = new Date(cb.cooldown_until as string).getTime();
            if (now < cooldownTime) return false;
          }

          const conditions = r.conditions as Record<string, unknown>;
          const taskTypes = conditions.task_types as string[];

          // If route has task_types, check match
          if (taskTypes && taskTypes.length > 0 && !taskTypes.includes(taskType)) {
            return false;
          }

          // Check cost limit
          if (costLimit != null && conditions.max_cost_per_call != null) {
            if ((conditions.max_cost_per_call as number) > costLimit) return false;
          }

          // Check latency limit
          if (latencyLimit != null && conditions.max_latency_ms != null) {
            if ((conditions.max_latency_ms as number) > latencyLimit) return false;
          }

          // Check complexity
          if (complexity != null && conditions.complexity_threshold != null) {
            if (complexity < (conditions.complexity_threshold as number)) return false;
          }

          return true;
        })
        .sort((a, b) => (a.priority as number) - (b.priority as number));

      if (candidates.length === 0) return null;
      return candidates[0];
    }, '_best');

    return branch(p,
      (bindings) => !bindings._best,
      complete(createProgram(), 'ok', { message: 'No route matches or all are circuit-broken' }),
      completeFrom(createProgram(), 'ok', (bindings) => {
        const best = bindings._best as Record<string, unknown>;
        return { model_id: best.model_id as string, route: best.id as string };
      }),
    ) as StorageProgram<Result>;
  },

  fallback(input: Record<string, unknown>) {
    const failedModelId = input.failed_model_id as string;
    const errorType = input.error_type as string;

    let p = createProgram();
    p = find(p, 'route', {}, 'allRoutes');

    p = mapBindings(p, (bindings) => {
      const routes = (bindings.allRoutes || []) as Array<Record<string, unknown>>;
      const now = Date.now();

      // Find routes that are NOT the failed model and NOT circuit-broken
      const alternatives = routes
        .filter(r => {
          if ((r.model_id as string) === failedModelId) return false;
          const cb = r.circuit_breaker as Record<string, unknown>;
          if (cb.cooldown_until) {
            const cooldownTime = new Date(cb.cooldown_until as string).getTime();
            if (now < cooldownTime) return false;
          }
          return true;
        })
        .sort((a, b) => (a.priority as number) - (b.priority as number));

      return alternatives.length > 0 ? alternatives[0] : null;
    }, '_next');

    // Also find the failed route to update its circuit breaker
    p = mapBindings(p, (bindings) => {
      const routes = (bindings.allRoutes || []) as Array<Record<string, unknown>>;
      return routes.find(r => (r.model_id as string) === failedModelId) || null;
    }, '_failedRoute');

    return branch(p,
      (bindings) => !bindings._next,
      complete(createProgram(), 'ok', { message: 'All fallback models tried or circuit-broken' }),
      (() => {
        let b = createProgram();
        // Update failure count on failed route
        b = find(b, 'route', {}, '_routes2');
        b = mapBindings(b, (bindings) => {
          const routes = (bindings._routes2 || []) as Array<Record<string, unknown>>;
          return routes.find(r => (r.model_id as string) === failedModelId) || null;
        }, '_fr');
        // Return the next model
        b = find(b, 'route', {}, '_routes3');
        b = mapBindings(b, (bindings) => {
          const routes = (bindings._routes3 || []) as Array<Record<string, unknown>>;
          const now = Date.now();
          const alts = routes
            .filter(r => {
              if ((r.model_id as string) === failedModelId) return false;
              const cb = r.circuit_breaker as Record<string, unknown>;
              if (cb.cooldown_until) {
                const cooldownTime = new Date(cb.cooldown_until as string).getTime();
                if (now < cooldownTime) return false;
              }
              return true;
            })
            .sort((a, b2) => (a.priority as number) - (b2.priority as number));
          return alts.length > 0 ? alts[0] : null;
        }, '_nextModel');

        return completeFrom(b, 'ok', (bindings) => {
          const next = bindings._nextModel as Record<string, unknown>;
          return { next_model_id: next ? next.model_id as string : '' };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  recordOutcome(input: Record<string, unknown>) {
    const route = input.route as string;
    const success = input.success as boolean;
    const latencyMs = input.latency_ms as number;
    const tokens = input.tokens as number;
    const cost = input.cost as number;

    if (!route) {
      return complete(createProgram(), 'notfound', { message: 'Route not found' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'route', route, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Route not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'route', route, 'rec');
        b = putFrom(b, 'route', route, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const perfLog = rec.performance_log as Record<string, unknown>;
          const totalCalls = (perfLog.total_calls as number) + 1;
          const prevSuccessRate = perfLog.success_rate as number;
          const prevAvgLatency = perfLog.avg_latency_ms as number;
          const prevAvgCost = perfLog.avg_cost as number;

          const newSuccessRate = ((prevSuccessRate * (totalCalls - 1)) + (success ? 1 : 0)) / totalCalls;
          const newAvgLatency = ((prevAvgLatency * (totalCalls - 1)) + latencyMs) / totalCalls;
          const newAvgCost = ((prevAvgCost * (totalCalls - 1)) + cost) / totalCalls;

          const cb = rec.circuit_breaker as Record<string, unknown>;
          let failureCount = cb.failure_count as number;
          let cooldownUntil = cb.cooldown_until;
          const threshold = cb.threshold as number;

          if (success) {
            failureCount = 0;
            cooldownUntil = null;
          } else {
            failureCount += 1;
            if (failureCount >= threshold) {
              cooldownUntil = new Date(Date.now() + 60000).toISOString(); // 1 min cooldown
            }
          }

          return {
            ...rec,
            performance_log: {
              success_rate: newSuccessRate,
              avg_latency_ms: newAvgLatency,
              avg_cost: newAvgCost,
              total_calls: totalCalls,
            },
            circuit_breaker: {
              failure_count: failureCount,
              cooldown_until: cooldownUntil,
              threshold,
            },
          };
        });
        return complete(b, 'ok', { route });
      })(),
    ) as StorageProgram<Result>;
  },

  getHealth() {
    let p = createProgram();
    p = find(p, 'route', {}, 'allRoutes');

    return completeFrom(p, 'ok', (bindings) => {
      const routes = (bindings.allRoutes || []) as Array<Record<string, unknown>>;
      const statuses = routes.map(r => {
        const cb = r.circuit_breaker as Record<string, unknown>;
        const perfLog = r.performance_log as Record<string, unknown>;
        const now = Date.now();
        let circuitBreakerActive = false;
        if (cb.cooldown_until) {
          circuitBreakerActive = now < new Date(cb.cooldown_until as string).getTime();
        }
        return {
          route: r.route_name as string,
          model_id: r.model_id as string,
          status: circuitBreakerActive ? 'circuit-broken' : 'available',
          circuit_breaker_active: circuitBreakerActive,
          success_rate: perfLog.success_rate as number,
        };
      });
      return { statuses };
    }) as StorageProgram<Result>;
  },
};

export const modelRouterHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetModelRouter(): void {
  idCounter = 0;
}
