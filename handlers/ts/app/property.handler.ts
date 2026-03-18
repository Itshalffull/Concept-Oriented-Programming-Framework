// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const propertyHandler: FunctionalConceptHandler = {
  set(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const key = input.key as string;
    const value = input.value as string;

    let p = createProgram();
    p = spGet(p, 'propertyType', key, 'typeRecord');
    p = spGet(p, 'property', entity, 'propsRecord');

    p = put(p, 'property', entity, {
      entity,
      properties: JSON.stringify({ [key]: value }),
    });

    return complete(p, 'ok', { entity }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const key = input.key as string;

    let p = createProgram();
    p = spGet(p, 'property', entity, 'propsRecord');
    p = branch(p, 'propsRecord',
      (b) => complete(b, 'ok', { value: '' }),
      (b) => complete(b, 'notfound', { message: 'not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const key = input.key as string;

    let p = createProgram();
    p = spGet(p, 'property', entity, 'propsRecord');
    p = branch(p, 'propsRecord',
      (b) => {
        let b2 = put(b, 'property', entity, {
          entity,
          properties: JSON.stringify({}),
        });
        return complete(b2, 'ok', { entity });
      },
      (b) => complete(b, 'notfound', { message: 'not found' }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineType(input: Record<string, unknown>) {
    const name = input.name as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'propertyType', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => {
        let b2 = put(b, 'propertyType', name, { name, schema });
        return complete(b2, 'ok', { name });
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listAll(input: Record<string, unknown>) {
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'property', entity, 'propsRecord');

    return complete(p, 'ok', { properties: JSON.stringify({}) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
