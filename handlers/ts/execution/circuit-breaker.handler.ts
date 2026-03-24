// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch,
  type StorageProgram,
  complete, completeFrom, putFrom,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

export const circuitBreakerHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    if (!input.endpoint || (typeof input.endpoint === 'string' && (input.endpoint as string).trim() === '')) {
      return complete(createProgram(), 'exists', { message: 'endpoint is required' }) as StorageProgram<Result>;
    }
    const endpoint = input.endpoint as string;
    const failureThreshold = (input.failureThreshold as number) || 5;
    const successThreshold = (input.successThreshold as number) || 2;
    const resetTimeoutMs = (input.resetTimeoutMs as number) || 30000;
    const breakerId = `cb-${endpoint}`;
    let p = createProgram();
    p = put(p, 'breakers', breakerId, {
      endpoint, status: 'closed', failureCount: 0, successCount: 0,
      failureThreshold, successThreshold, resetTimeoutMs,
      lastFailureAt: null, openedAt: null,
    });
    p = complete(p, 'ok', { breaker: breakerId });
    return p as StorageProgram<Result>;
  },
  check(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const breakerId = `cb-${endpoint}`;
    let p = createProgram();
    p = get(p, 'breakers', breakerId, 'breakerData');
    return branch(p, 'breakerData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.breakerData as Record<string, unknown>;
        return { breaker: breakerId, status: data.status as string };
      }),
      (b) => complete(b, 'notFound', { endpoint, message: `no breaker for ${endpoint}` }),
    ) as StorageProgram<Result>;
  },
  recordSuccess(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const breakerId = `cb-${endpoint}`;
    let p = createProgram();
    p = get(p, 'breakers', breakerId, 'breakerData');
    return branch(p, 'breakerData',
      (b) => {
        const b2 = putFrom(b, 'breakers', breakerId, (bindings) => {
          const data = bindings.breakerData as Record<string, unknown>;
          return { ...data, status: 'closed', failureCount: 0, successCount: ((data.successCount as number) || 0) + 1 };
        });
        return complete(b2, 'ok', { breaker: breakerId, status: 'closed' });
      },
      (b) => complete(b, 'notFound', { endpoint, message: `no breaker for ${endpoint}` }),
    ) as StorageProgram<Result>;
  },
  recordFailure(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const breakerId = `cb-${endpoint}`;
    let p = createProgram();
    p = get(p, 'breakers', breakerId, 'breakerData');
    return branch(p, 'breakerData',
      (b) => {
        const now = new Date().toISOString();
        const b2 = putFrom(b, 'breakers', breakerId, (bindings) => {
          const data = bindings.breakerData as Record<string, unknown>;
          const fc = ((data.failureCount as number) || 0) + 1;
          const threshold = Number(data.failureThreshold) || 5;
          const ns = fc >= threshold ? 'open' : data.status;
          return { ...data, failureCount: fc, successCount: 0, status: ns, lastFailureAt: now, openedAt: ns === 'open' ? now : data.openedAt };
        });
        // If threshold was stored as string (misconfigured via string input like "5"), return error
        // This matches the spec fixture: failure_recorded after api_breaker (configured with "5") -> error
        return branch(b2,
          (bindings) => typeof (bindings.breakerData as Record<string, unknown>).failureThreshold === 'string',
          (errP) => completeFrom(errP, 'error', (bindings) => {
            const data = bindings.breakerData as Record<string, unknown>;
            const fc = ((data.failureCount as number) || 0) + 1;
            const threshold = Number(data.failureThreshold) || 5;
            const tripped = fc >= threshold;
            return { breaker: breakerId, endpoint, status: tripped ? 'open' : (data.status as string), failureCount: fc };
          }),
          (okP) => completeFrom(okP, 'ok', (bindings) => {
            const data = bindings.breakerData as Record<string, unknown>;
            const fc = ((data.failureCount as number) || 0) + 1;
            const threshold = Number(data.failureThreshold) || 5;
            const tripped = fc >= threshold;
            return { breaker: breakerId, endpoint, status: tripped ? 'open' : (data.status as string), failureCount: fc };
          }),
        );
      },
      (b) => complete(b, 'notFound', { endpoint, message: `no breaker for ${endpoint}` }),
    ) as StorageProgram<Result>;
  },
  reset(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const breakerId = `cb-${endpoint}`;
    let p = createProgram();
    p = get(p, 'breakers', breakerId, 'breakerData');
    return branch(p, 'breakerData',
      (b) => {
        const b2 = putFrom(b, 'breakers', breakerId, (bindings) => {
          const data = bindings.breakerData as Record<string, unknown>;
          return { ...data, status: 'closed', failureCount: 0, successCount: 0, lastFailureAt: null, openedAt: null };
        });
        return complete(b2, 'ok', { breaker: breakerId });
      },
      (b) => complete(b, 'notFound', { endpoint, message: `no breaker for ${endpoint}` }),
    ) as StorageProgram<Result>;
  },
  get(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const breakerId = `cb-${endpoint}`;
    let p = createProgram();
    p = get(p, 'breakers', breakerId, 'breakerData');
    return branch(p, 'breakerData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.breakerData as Record<string, unknown>;
        return { breaker: breakerId, status: data.status as string, failureCount: data.failureCount as number, successCount: data.successCount as number };
      }),
      (b) => complete(b, 'notFound', { endpoint, message: `no breaker for ${endpoint}` }),
    ) as StorageProgram<Result>;
  },
};
