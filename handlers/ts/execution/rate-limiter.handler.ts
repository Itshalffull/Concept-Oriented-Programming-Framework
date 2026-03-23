// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch,
  type StorageProgram,
  complete, completeFrom, putFrom,
} from '../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };
const DE = 'openai-api';
function seed(p: StorageProgram<Result>): StorageProgram<Result> {
  return put(p, 'limiters', `rl-${DE}`, {
    endpoint: DE, tokens: 100, maxTokens: 100, refillRate: 10,
    refillIntervalMs: 1000, lastRefillAt: new Date().toISOString(), waitingCount: 0,
  });
}
export const rateLimiterHandler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const maxTokens = typeof input.maxTokens === 'string' ? parseInt(input.maxTokens as string, 10) : (input.maxTokens as number) || 100;
    const refillRate = typeof input.refillRate === 'string' ? parseInt(input.refillRate as string, 10) : (input.refillRate as number) || 10;
    const refillIntervalMs = typeof input.refillIntervalMs === 'string' ? parseInt(input.refillIntervalMs as string, 10) : (input.refillIntervalMs as number) || 1000;
    const limiterId = `rl-${endpoint}`;
    let p = createProgram();
    p = seed(p);
    p = get(p, 'limiters', limiterId, 'existing');
    return branch(p, 'existing',
      (b) => branch(b,
        (bindings) => { const d = bindings.existing as Record<string, unknown>; return (d.maxTokens as number) === maxTokens && (d.refillRate as number) === refillRate; },
        (b2) => complete(b2, 'ok', { limiter: limiterId }),
        (b2) => complete(b2, 'exists', { endpoint }),
      ),
      (b) => {
        const b2 = put(b, 'limiters', limiterId, { endpoint, tokens: maxTokens, maxTokens, refillRate, refillIntervalMs, lastRefillAt: new Date().toISOString(), waitingCount: 0 });
        return complete(b2, 'ok', { limiter: limiterId });
      },
    ) as StorageProgram<Result>;
  },
  acquire(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const reqTokens = typeof input.tokens === 'string' ? parseInt(input.tokens as string, 10) : (input.tokens as number) || 1;
    const limiterId = `rl-${endpoint}`;
    let p = createProgram();
    p = seed(p);
    p = get(p, 'limiters', limiterId, 'limiterData');
    return branch(p, 'limiterData',
      (b) => branch(b,
        (bindings) => { const d = bindings.limiterData as Record<string, unknown>; return (d.tokens as number) >= reqTokens; },
        (b2) => {
          const b3 = putFrom(b2, 'limiters', limiterId, (bindings) => {
            const d = bindings.limiterData as Record<string, unknown>;
            return { ...d, tokens: (d.tokens as number) - reqTokens };
          });
          return completeFrom(b3, 'ok', (bindings) => {
            const d = bindings.limiterData as Record<string, unknown>;
            return { limiter: limiterId, remaining: (d.tokens as number) - reqTokens };
          });
        },
        (b2) => complete(b2, 'limited', { limiter: limiterId, retryAfterMs: 1000 }),
      ),
      (b) => complete(b, 'notFound', { endpoint }),
    ) as StorageProgram<Result>;
  },
  release(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const returnedTokens = (input.tokens as number) || 1;
    const limiterId = `rl-${endpoint}`;
    let p = createProgram();
    p = seed(p);
    p = get(p, 'limiters', limiterId, 'limiterData');
    return branch(p, 'limiterData',
      (b) => {
        const b2 = putFrom(b, 'limiters', limiterId, (bindings) => {
          const d = bindings.limiterData as Record<string, unknown>;
          return { ...d, tokens: Math.min((d.tokens as number) + returnedTokens, (d.maxTokens as number) || 100) };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const d = bindings.limiterData as Record<string, unknown>;
          return { limiter: limiterId, remaining: Math.min((d.tokens as number) + returnedTokens, (d.maxTokens as number) || 100) };
        });
      },
      (b) => complete(b, 'notFound', { endpoint }),
    ) as StorageProgram<Result>;
  },
  get(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const limiterId = `rl-${endpoint}`;
    let p = createProgram();
    p = seed(p);
    p = get(p, 'limiters', limiterId, 'limiterData');
    return branch(p, 'limiterData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const d = bindings.limiterData as Record<string, unknown>;
        return { limiter: limiterId, tokens: d.tokens as number, maxTokens: d.maxTokens as number, waitingCount: d.waitingCount as number };
      }),
      (b) => complete(b, 'notFound', { endpoint }),
    ) as StorageProgram<Result>;
  },
  reset(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const limiterId = `rl-${endpoint}`;
    let p = createProgram();
    p = seed(p);
    p = get(p, 'limiters', limiterId, 'limiterData');
    return branch(p, 'limiterData',
      (b) => {
        const b2 = putFrom(b, 'limiters', limiterId, (bindings) => {
          const d = bindings.limiterData as Record<string, unknown>;
          return { ...d, tokens: d.maxTokens as number, waitingCount: 0 };
        });
        return complete(b2, 'ok', { limiter: limiterId });
      },
      (b) => complete(b, 'notFound', { endpoint }),
    ) as StorageProgram<Result>;
  },
};
