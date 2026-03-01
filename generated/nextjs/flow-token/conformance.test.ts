// FlowToken — conformance.test.ts

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { flowTokenHandler } from './handler.js';
import type { FlowTokenStorage } from './types.js';

const createTestStorage = (): FlowTokenStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter) => {
      const entries = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return entries;
      return entries.filter((e) =>
        Object.entries(filter).every(([k, v]) => e[k] === v),
      );
    },
  };
};

describe('FlowToken conformance', () => {
  it('invariant: emit creates an active token at the given position', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await pipe(
      handler.emit({ run_ref: 'r1', position: 'start', payload: '{}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.token_id).toBeTruthy();
        expect(output.position).toBe('start');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: consume transitions an active token and prevents double-consume', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const emitResult = await handler.emit({ run_ref: 'r1', position: 'step1', payload: '{}' }, storage)();
    if (E.isLeft(emitResult)) throw new Error('emit failed');
    const tokenId = emitResult.right.token_id;

    // First consume succeeds
    const consumeResult = await pipe(
      handler.consume({ token_id: tokenId }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        return output;
      }),
    )();
    expect(E.isRight(consumeResult)).toBe(true);

    // Second consume returns already_consumed
    const doubleConsumeResult = await pipe(
      handler.consume({ token_id: tokenId }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('already_consumed');
        return output;
      }),
    )();
    expect(E.isRight(doubleConsumeResult)).toBe(true);
  });

  it('invariant: consume returns not_found for unknown token', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await pipe(
      handler.consume({ token_id: 'nonexistent' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: kill marks a token as killed', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const emitResult = await handler.emit({ run_ref: 'r1', position: 'gate', payload: '{}' }, storage)();
    if (E.isLeft(emitResult)) throw new Error('emit failed');
    const tokenId = emitResult.right.token_id;

    const killResult = await pipe(
      handler.kill({ token_id: tokenId, reason: 'timeout' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        return output;
      }),
    )();
    expect(E.isRight(killResult)).toBe(true);

    // Consuming a killed token returns already_consumed
    const consumeResult = await pipe(
      handler.consume({ token_id: tokenId }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('already_consumed');
        return output;
      }),
    )();
    expect(E.isRight(consumeResult)).toBe(true);
  });

  it('invariant: kill returns not_found for unknown token', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await pipe(
      handler.kill({ token_id: 'nonexistent', reason: 'test' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: countActive counts only active tokens', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const e1 = await handler.emit({ run_ref: 'r1', position: 'a', payload: '{}' }, storage)();
    const e2 = await handler.emit({ run_ref: 'r1', position: 'b', payload: '{}' }, storage)();
    await handler.emit({ run_ref: 'r1', position: 'c', payload: '{}' }, storage)();

    // Consume one token
    if (E.isRight(e1)) {
      await handler.consume({ token_id: e1.right.token_id }, storage)();
    }
    // Kill another token
    if (E.isRight(e2)) {
      await handler.kill({ token_id: e2.right.token_id, reason: 'test' }, storage)();
    }

    const result = await pipe(
      handler.countActive({ run_ref: 'r1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.count).toBe(1);
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: listActive returns only active tokens for a run', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    await handler.emit({ run_ref: 'r1', position: 'x', payload: '{}' }, storage)();
    await handler.emit({ run_ref: 'r1', position: 'y', payload: '{}' }, storage)();
    await handler.emit({ run_ref: 'r2', position: 'z', payload: '{}' }, storage)();

    const result = await pipe(
      handler.listActive({ run_ref: 'r1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        expect(output.count).toBe(2);
        const parsed = JSON.parse(output.tokens);
        expect(parsed).toHaveLength(2);
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });
});
