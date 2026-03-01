// ProcessSpec — conformance.test.ts

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

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

describe('ProcessSpec conformance', () => {
  it('invariant: create produces a draft spec and get retrieves it', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    const createResult = await pipe(
      handler.create({ spec_id: 'spec1', name: 'Order Process', definition: '{}', version: '1.0.0' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('draft');
        }
        return output;
      }),
    )();
    expect(E.isRight(createResult)).toBe(true);

    const getResult = await pipe(
      handler.get({ spec_id: 'spec1' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.name).toBe('Order Process');
          expect(output.status).toBe('draft');
          expect(output.revision).toBe(1);
        }
        return output;
      }),
    )();
    expect(E.isRight(getResult)).toBe(true);
  });

  it('invariant: create returns already_exists for duplicate spec_id', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 's1', name: 'A', definition: '{}', version: '1.0' }, storage)();

    const result = await pipe(
      handler.create({ spec_id: 's1', name: 'B', definition: '{}', version: '2.0' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('already_exists');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: lifecycle draft -> active -> deprecated', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 's2', name: 'Lifecycle', definition: '{}', version: '1.0' }, storage)();

    // Publish: draft -> active
    const pubResult = await pipe(
      handler.publish({ spec_id: 's2' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('active');
        }
        return output;
      }),
    )();
    expect(E.isRight(pubResult)).toBe(true);

    // Deprecate: active -> deprecated
    const depResult = await pipe(
      handler.deprecate({ spec_id: 's2', reason: 'replaced by v2' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.status).toBe('deprecated');
        }
        return output;
      }),
    )();
    expect(E.isRight(depResult)).toBe(true);
  });

  it('invariant: publish rejects non-draft specs', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 's3', name: 'X', definition: '{}', version: '1.0' }, storage)();
    await handler.publish({ spec_id: 's3' }, storage)();

    // Publishing an already-active spec fails
    const result = await pipe(
      handler.publish({ spec_id: 's3' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        if (output.variant === 'invalid_transition') {
          expect(output.current_status).toBe('active');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: deprecate rejects non-active specs', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 's4', name: 'Y', definition: '{}', version: '1.0' }, storage)();

    // Cannot deprecate a draft spec
    const result = await pipe(
      handler.deprecate({ spec_id: 's4', reason: 'test' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('invalid_transition');
        if (output.variant === 'invalid_transition') {
          expect(output.current_status).toBe('draft');
        }
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });

  it('invariant: update only works on draft specs and increments revision', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    await handler.create({ spec_id: 's5', name: 'Z', definition: '{"v":1}', version: '1.0' }, storage)();

    // Update in draft succeeds
    const updateResult = await pipe(
      handler.update({ spec_id: 's5', definition: '{"v":2}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('ok');
        if (output.variant === 'ok') {
          expect(output.revision).toBe(2);
        }
        return output;
      }),
    )();
    expect(E.isRight(updateResult)).toBe(true);

    // Publish then try to update
    await handler.publish({ spec_id: 's5' }, storage)();

    const updateAfterPublish = await pipe(
      handler.update({ spec_id: 's5', definition: '{"v":3}' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_draft');
        return output;
      }),
    )();
    expect(E.isRight(updateAfterPublish)).toBe(true);
  });

  it('invariant: get returns not_found for unknown spec', async () => {
    const storage = createTestStorage();
    const handler = processSpecHandler;

    const result = await pipe(
      handler.get({ spec_id: 'nonexistent' }, storage),
      TE.map((output) => {
        expect(output.variant).toBe('not_found');
        return output;
      }),
    )();
    expect(E.isRight(result)).toBe(true);
  });
});
