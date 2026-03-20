// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _typeSystemHandler: FunctionalConceptHandler = {
  registerType(input: Record<string, unknown>) {
    const type = input.type as string;
    const schema = input.schema as string;
    const constraints = input.constraints as string;
    let p = createProgram();
    p = spGet(p, 'type', type, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => { let b2 = put(b, 'type', type, { type, schema, constraints, parent: '' }); return complete(b2, 'ok', { type }); },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const type = input.type as string;
    let p = createProgram();
    p = spGet(p, 'type', type, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return record.schema as string;
        }, 'schema');
        return completeFrom(b2, 'ok', (bindings) => ({ type, schema: bindings.schema as string }));
      },
      (b) => complete(b, 'notfound', { message: 'Type not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const type = input.type as string;
    const value = input.value as string;
    let p = createProgram();
    p = spGet(p, 'type', type, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const schema = JSON.parse(record.schema as string);
          let valid = true;
          if (schema.type) { const actualType = typeof JSON.parse(value); if (actualType !== schema.type) valid = false; }
          return valid;
        }, 'valid');
        return completeFrom(b2, 'ok', (bindings) => ({ valid: bindings.valid as boolean }));
      },
      (b) => complete(b, 'notfound', { message: 'Type not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  navigate(input: Record<string, unknown>) {
    const type = input.type as string;
    const path = input.path as string;
    let p = createProgram();
    p = spGet(p, 'type', type, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const schema = JSON.parse(record.schema as string);
          const segments = path.split('.');
          let current = schema;
          for (const segment of segments) {
            if (current.properties && current.properties[segment]) { current = current.properties[segment]; }
            else { return null; }
          }
          return JSON.stringify(current);
        }, 'resultSchema');
        b2 = branch(b2, 'resultSchema',
          (b3) => completeFrom(b3, 'ok', (bindings) => ({ type, schema: bindings.resultSchema as string })),
          (b3) => complete(b3, 'notfound', { message: `Path segment not found` }),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: 'Type not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  serialize(input: Record<string, unknown>) {
    const type = input.type as string;
    const value = input.value as string;
    let p = createProgram();
    p = spGet(p, 'type', type, 'record');
    p = branch(p, 'record',
      (b) => { const parsed = JSON.parse(value); return complete(b, 'ok', { serialized: JSON.stringify(parsed) }); },
      (b) => complete(b, 'notfound', { message: 'Type not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const typeSystemHandler = autoInterpret(_typeSystemHandler);

