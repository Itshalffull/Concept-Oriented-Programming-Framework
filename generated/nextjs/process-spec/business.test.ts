// ProcessSpec — business.test.ts
// Business logic tests for blueprint definitions with lifecycle management.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { processSpecHandler } from './handler.js';
import type { ProcessSpecStorage } from './types.js';

const createTestStorage = (): ProcessSpecStorage => {
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

describe('ProcessSpec business logic', () => {
  it('full lifecycle: draft -> publish -> deprecate preserves all data', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({
      spec_id: 'order-flow-v1',
      name: 'Order Processing',
      definition: '{"steps":["validate","charge","ship"]}',
      version: '1.0.0',
    }, storage)();

    const getResult1 = await handler.get({ spec_id: 'order-flow-v1' }, storage)();
    expect(E.isRight(getResult1)).toBe(true);
    if (E.isRight(getResult1) && getResult1.right.variant === 'ok') {
      expect(getResult1.right.status).toBe('draft');
      expect(getResult1.right.name).toBe('Order Processing');
      expect(getResult1.right.definition).toBe('{"steps":["validate","charge","ship"]}');
      expect(getResult1.right.version).toBe('1.0.0');
      expect(getResult1.right.revision).toBe(1);
    }

    await handler.publish({ spec_id: 'order-flow-v1' }, storage)();

    const getResult2 = await handler.get({ spec_id: 'order-flow-v1' }, storage)();
    if (E.isRight(getResult2) && getResult2.right.variant === 'ok') {
      expect(getResult2.right.status).toBe('active');
    }

    await handler.deprecate({ spec_id: 'order-flow-v1', reason: 'Replaced by v2' }, storage)();

    const getResult3 = await handler.get({ spec_id: 'order-flow-v1' }, storage)();
    if (E.isRight(getResult3) && getResult3.right.variant === 'ok') {
      expect(getResult3.right.status).toBe('deprecated');
    }
  });

  it('multiple updates to draft increment revision correctly', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({
      spec_id: 'iter-spec',
      name: 'Iterative Spec',
      definition: '{"v":1}',
      version: '0.1.0',
    }, storage)();

    const u1 = await handler.update({ spec_id: 'iter-spec', definition: '{"v":2}' }, storage)();
    expect(E.isRight(u1)).toBe(true);
    if (E.isRight(u1) && u1.right.variant === 'ok') {
      expect(u1.right.revision).toBe(2);
    }

    const u2 = await handler.update({ spec_id: 'iter-spec', definition: '{"v":3}' }, storage)();
    if (E.isRight(u2) && u2.right.variant === 'ok') {
      expect(u2.right.revision).toBe(3);
    }

    const u3 = await handler.update({ spec_id: 'iter-spec', definition: '{"v":4}' }, storage)();
    if (E.isRight(u3) && u3.right.variant === 'ok') {
      expect(u3.right.revision).toBe(4);
    }

    const getResult = await handler.get({ spec_id: 'iter-spec' }, storage)();
    if (E.isRight(getResult) && getResult.right.variant === 'ok') {
      expect(getResult.right.definition).toBe('{"v":4}');
      expect(getResult.right.revision).toBe(4);
    }
  });

  it('update rejects non-draft specs (active and deprecated)', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 'locked', name: 'Locked', definition: '{}', version: '1.0.0' }, storage)();
    await handler.publish({ spec_id: 'locked' }, storage)();

    const updateActive = await handler.update({ spec_id: 'locked', definition: '{"new":true}' }, storage)();
    expect(E.isRight(updateActive)).toBe(true);
    if (E.isRight(updateActive)) {
      expect(updateActive.right.variant).toBe('not_draft');
    }

    await handler.deprecate({ spec_id: 'locked', reason: 'old' }, storage)();

    const updateDeprecated = await handler.update({ spec_id: 'locked', definition: '{"newer":true}' }, storage)();
    expect(E.isRight(updateDeprecated)).toBe(true);
    if (E.isRight(updateDeprecated)) {
      expect(updateDeprecated.right.variant).toBe('not_draft');
    }
  });

  it('cannot skip lifecycle steps: draft cannot deprecate directly', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 'skip-test', name: 'Skip', definition: '{}', version: '1.0.0' }, storage)();

    const result = await handler.deprecate({ spec_id: 'skip-test', reason: 'premature' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_transition');
    }
  });

  it('cannot publish an already active spec', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 'double-pub', name: 'DP', definition: '{}', version: '1.0.0' }, storage)();
    await handler.publish({ spec_id: 'double-pub' }, storage)();

    const result = await handler.publish({ spec_id: 'double-pub' }, storage)();
    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.variant).toBe('invalid_transition');
    }
  });

  it('operations on non-existent spec return not_found variants', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    const pub = await handler.publish({ spec_id: 'ghost' }, storage)();
    expect(E.isRight(pub)).toBe(true);
    if (E.isRight(pub)) expect(pub.right.variant).toBe('not_found');

    const dep = await handler.deprecate({ spec_id: 'ghost', reason: 'n/a' }, storage)();
    expect(E.isRight(dep)).toBe(true);
    if (E.isRight(dep)) expect(dep.right.variant).toBe('not_found');

    const upd = await handler.update({ spec_id: 'ghost', definition: '{}' }, storage)();
    expect(E.isRight(upd)).toBe(true);
    if (E.isRight(upd)) expect(upd.right.variant).toBe('not_found');

    const get = await handler.get({ spec_id: 'ghost' }, storage)();
    expect(E.isRight(get)).toBe(true);
    if (E.isRight(get)) expect(get.right.variant).toBe('not_found');
  });

  it('deprecated spec cannot be re-published or re-deprecated', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 'dep-locked', name: 'DepLocked', definition: '{}', version: '1.0.0' }, storage)();
    await handler.publish({ spec_id: 'dep-locked' }, storage)();
    await handler.deprecate({ spec_id: 'dep-locked', reason: 'done' }, storage)();

    const rePub = await handler.publish({ spec_id: 'dep-locked' }, storage)();
    expect(E.isRight(rePub)).toBe(true);
    if (E.isRight(rePub)) expect(rePub.right.variant).toBe('invalid_transition');

    const reDep = await handler.deprecate({ spec_id: 'dep-locked', reason: 'again' }, storage)();
    expect(E.isRight(reDep)).toBe(true);
    if (E.isRight(reDep)) expect(reDep.right.variant).toBe('invalid_transition');
  });

  it('concurrent specs have independent lifecycles', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 'spec-a', name: 'A', definition: '{"a":1}', version: '1.0.0' }, storage)();
    await handler.create({ spec_id: 'spec-b', name: 'B', definition: '{"b":1}', version: '1.0.0' }, storage)();

    await handler.publish({ spec_id: 'spec-a' }, storage)();

    const getA = await handler.get({ spec_id: 'spec-a' }, storage)();
    const getB = await handler.get({ spec_id: 'spec-b' }, storage)();

    if (E.isRight(getA) && getA.right.variant === 'ok') {
      expect(getA.right.status).toBe('active');
    }
    if (E.isRight(getB) && getB.right.variant === 'ok') {
      expect(getB.right.status).toBe('draft');
    }
  });
});
