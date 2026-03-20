// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _propertyHandler: FunctionalConceptHandler = {
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
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.propsRecord as Record<string, unknown>;
        const props = JSON.parse((record.properties as string) || '{}');
        if (key in props) return { value: props[key] };
        return { variant: 'notfound', message: 'not found' };
      }),
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
        let b2 = del(b, 'property', entity);
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

export const propertyHandler = autoInterpret(_propertyHandler);

