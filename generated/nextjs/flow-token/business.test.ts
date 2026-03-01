// FlowToken — business.test.ts
// Business logic tests for flow control tokens with emit, consume, kill, and counting.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

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

describe('FlowToken business logic', () => {
  it('emit multiple tokens then consume them reduces active count to zero', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const tokenIds: string[] = [];

    for (let i = 0; i < 4; i++) {
      const result = await handler.emit({
        run_ref: 'run-1',
        position: `step-${i}`,
        payload: `{"index":${i}}`,
      }, storage)();
      if (E.isRight(result) && result.right.variant === 'ok') {
        tokenIds.push(result.right.token_id);
      }
    }

    expect(tokenIds).toHaveLength(4);

    const countBefore = await handler.countActive({ run_ref: 'run-1' }, storage)();
    if (E.isRight(countBefore)) {
      expect(countBefore.right.count).toBe(4);
    }

    for (const id of tokenIds) {
      await handler.consume({ token_id: id }, storage)();
    }

    const countAfter = await handler.countActive({ run_ref: 'run-1' }, storage)();
    if (E.isRight(countAfter)) {
      expect(countAfter.right.count).toBe(0);
    }
  });

  it('consume returns already_consumed for consumed token', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const emitResult = await handler.emit({
      run_ref: 'run-2',
      position: 'gate',
      payload: '{}',
    }, storage)();

    let tokenId = '';
    if (E.isRight(emitResult) && emitResult.right.variant === 'ok') {
      tokenId = emitResult.right.token_id;
    }

    await handler.consume({ token_id: tokenId }, storage)();

    const result = await handler.consume({ token_id: tokenId }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('already_consumed');
    }
  });

  it('consume returns not_found for non-existent token', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await handler.consume({ token_id: 'nonexistent-token' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('kill token makes it not appear in active list or count', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const e1 = await handler.emit({ run_ref: 'run-3', position: 'a', payload: '{}' }, storage)();
    const e2 = await handler.emit({ run_ref: 'run-3', position: 'b', payload: '{}' }, storage)();

    let token1 = '', token2 = '';
    if (E.isRight(e1) && e1.right.variant === 'ok') token1 = e1.right.token_id;
    if (E.isRight(e2) && e2.right.variant === 'ok') token2 = e2.right.token_id;

    await handler.kill({ token_id: token1, reason: 'branch cancelled' }, storage)();

    const count = await handler.countActive({ run_ref: 'run-3' }, storage)();
    if (E.isRight(count)) {
      expect(count.right.count).toBe(1);
    }

    const list = await handler.listActive({ run_ref: 'run-3' }, storage)();
    if (E.isRight(list) && list.right.variant === 'ok') {
      expect(list.right.count).toBe(1);
      const tokens = JSON.parse(list.right.tokens);
      expect(tokens[0].token_id).toBe(token2);
    }
  });

  it('killed token cannot be consumed', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const emitResult = await handler.emit({
      run_ref: 'run-4',
      position: 'junction',
      payload: '{}',
    }, storage)();

    let tokenId = '';
    if (E.isRight(emitResult) && emitResult.right.variant === 'ok') {
      tokenId = emitResult.right.token_id;
    }

    await handler.kill({ token_id: tokenId, reason: 'timeout' }, storage)();

    const consumeResult = await handler.consume({ token_id: tokenId }, storage)();
    expect(E.isRight(consumeResult)).toBe(true);
    if (E.isRight(consumeResult)) {
      expect(consumeResult.right.variant).toBe('already_consumed');
    }
  });

  it('kill returns not_found for non-existent token', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await handler.kill({ token_id: 'no-such-token', reason: 'cleanup' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('not_found');
    }
  });

  it('listActive returns empty for run with no tokens', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await handler.listActive({ run_ref: 'empty-run' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result) && result.right.variant === 'ok') {
      expect(result.right.count).toBe(0);
      const tokens = JSON.parse(result.right.tokens);
      expect(tokens).toHaveLength(0);
    }
  });

  it('countActive returns zero for run with no tokens', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const result = await handler.countActive({ run_ref: 'no-tokens-run' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.count).toBe(0);
    }
  });

  it('tokens across different runs are isolated', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    await handler.emit({ run_ref: 'run-a', position: 'p1', payload: '{}' }, storage)();
    await handler.emit({ run_ref: 'run-a', position: 'p2', payload: '{}' }, storage)();
    await handler.emit({ run_ref: 'run-b', position: 'p1', payload: '{}' }, storage)();

    const countA = await handler.countActive({ run_ref: 'run-a' }, storage)();
    const countB = await handler.countActive({ run_ref: 'run-b' }, storage)();

    if (E.isRight(countA)) expect(countA.right.count).toBe(2);
    if (E.isRight(countB)) expect(countB.right.count).toBe(1);
  });

  it('each emitted token gets a unique ID', async () => {
    const storage = createTestStorage();
    const handler = flowTokenHandler;

    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = await handler.emit({
        run_ref: 'run-unique',
        position: 'pos',
        payload: '{}',
      }, storage)();
      if (E.isRight(result) && result.right.variant === 'ok') {
        ids.add(result.right.token_id);
      }
    }
    expect(ids.size).toBe(10);
  });
});
