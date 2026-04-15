// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Schema Concept Implementation
// Per spec §2.1, §2.4: Schema is a composable mixin applied to ContentNodes.
// A ContentNode's identity is the set of Schemas currently applied to it.
// Schema manages: definitions (fields, constraints, inheritance) and
// entity↔schema membership (applyTo, removeFrom, getSchemasFor).
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _schemaHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'schema', {}, 'items');
    p = completeFrom(p, 'ok', (bindings) => {
      const rows = (bindings.items as Array<Record<string, unknown>> | undefined) || [];
      // Return the row objects themselves (slash menu reads name/label/icon).
      return { items: JSON.stringify(rows) };
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'schema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'notfound', { message: 'Schema does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineSchema(input: Record<string, unknown>) {
    // fields is optional — schema editor UI creates a shell first, then adds fields
    // one by one via FieldDefinition/create (two-step UX). An empty fields param
    // stores an empty list and returns ok.
    const schema = input.schema as string;
    const rawFields = input.fields as string | undefined;
    const label = (input.label as string | undefined) ?? schema;
    const category = (input.category as string | undefined) ?? '';
    const icon = (input.icon as string | undefined) ?? '';

    // Normalise: undefined/null/empty string → empty list; otherwise split by comma.
    const fieldList: string[] =
      rawFields && rawFields.trim() !== ''
        ? rawFields.split(',').map((f) => f.trim()).filter(Boolean)
        : [];

    let p = createProgram();
    p = spGet(p, 'schema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'Schema already exists' }),
      (b) => {
        let b2 = put(b, 'schema', schema, {
          schema,
          label,
          category,
          icon,
          fields: JSON.stringify(fieldList),
          extends: '',
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addField(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const field = input.field as string;

    let p = createProgram();
    p = spGet(p, 'schema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'schema', schema, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const fields: string[] = JSON.parse(existing.fields as string);
          if (!fields.includes(field)) {
            fields.push(field);
          }
          return { ...existing, fields: JSON.stringify(fields) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Schema does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  extendSchema(input: Record<string, unknown>) {
    if (!input.parent || (typeof input.parent === 'string' && (input.parent as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'parent is required' }) as StorageProgram<Result>;
    }
    const schema = input.schema as string;
    const parent = input.parent as string;

    let p = createProgram();
    p = spGet(p, 'schema', parent, 'parentRecord');
    p = branch(p, 'parentRecord',
      (b) => {
        // Parent exists — upsert the child schema with extends set
        let b2 = spGet(b, 'schema', schema, 'schemaRecord');
        b2 = putFrom(b2, 'schema', schema, (bindings) => {
          const existing = bindings.schemaRecord as Record<string, unknown> | undefined;
          return existing
            ? { ...existing, extends: parent }
            : { schema, label: schema, category: '', icon: '', fields: '[]', extends: parent, createdAt: new Date().toISOString() };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Parent schema does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  applyTo(input: Record<string, unknown>) {
    if (!input.schema || (typeof input.schema === 'string' && (input.schema as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as StorageProgram<Result>;
    }
    const entity_id = input.entity_id as string;
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'schema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const membershipKey = `${entity_id}::${schema}`;
        let b2 = spGet(b, 'membership', membershipKey, 'alreadyApplied');
        b2 = branch(b2, 'alreadyApplied',
          (b3) => complete(b3, 'ok', { message: 'Already applied' }),
          (b3) => {
            let b4 = put(b3, 'membership', membershipKey, {
              entity_id,
              schema,
              appliedAt: new Date().toISOString(),
            });
            return complete(b4, 'ok', {});
          },
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: 'Schema does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeFrom(input: Record<string, unknown>) {
    const entity_id = input.entity_id as string;
    const schema = input.schema as string;
    const membershipKey = `${entity_id}::${schema}`;

    let p = createProgram();
    p = spGet(p, 'membership', membershipKey, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'membership', membershipKey);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Entity does not have this schema applied' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getSchemasFor(input: Record<string, unknown>) {
    const entity_id = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'membership', {}, 'allMemberships');
    p = mapBindings(p, (bindings) => {
      const memberships = Array.isArray(bindings.allMemberships) ? bindings.allMemberships : [];
      const schemas = memberships
        .filter((m: Record<string, unknown>) => m.entity_id === entity_id)
        .map((m: Record<string, unknown>) => m.schema as string);
      return JSON.stringify(schemas);
    }, 'schemasJson');
    return complete(p, 'ok', { schemas: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getEntitiesFor(input: Record<string, unknown>) {
    const schema = input.schema as string;

    let p = createProgram();
    p = find(p, 'membership', {}, 'allMemberships');
    p = mapBindings(p, (bindings) => {
      const memberships = Array.isArray(bindings.allMemberships) ? bindings.allMemberships : [];
      const entities = memberships
        .filter((m: Record<string, unknown>) => m.schema === schema)
        .map((m: Record<string, unknown>) => m.entity_id as string);
      return JSON.stringify(entities);
    }, 'entitiesJson');
    return complete(p, 'ok', { entities: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listMemberships(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'membership', {}, 'items');
    p = mapBindings(p, (bindings) => {
      return JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []);
    }, 'itemsJson');
    return complete(p, 'ok', { items: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getAssociations(input: Record<string, unknown>) {
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'schema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { associations: '[]' }),
      (b) => complete(b, 'notfound', { message: 'Schema does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  export(input: Record<string, unknown>) {
    const schema = input.schema as string;

    let p = createProgram();
    p = spGet(p, 'schema', schema, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = find(b, 'membership', {}, 'allMemberships');
        b2 = mapBindings(b2, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const fields: string[] = JSON.parse(existing.fields as string);
          const parentSchema = existing.extends as string;
          const memberships = Array.isArray(bindings.allMemberships) ? bindings.allMemberships : [];
          const entities = memberships
            .filter((m: Record<string, unknown>) => m.schema === schema)
            .map((m: Record<string, unknown>) => m.entity_id as string);
          const data = {
            schema,
            fields,
            extends: parentSchema || null,
            entities,
          };
          return JSON.stringify(data);
        }, 'dataJson');
        return complete(b2, 'ok', { data: '' });
      },
      (b) => complete(b, 'notfound', { message: 'Schema does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const schemaHandler = autoInterpret(_schemaHandler);

