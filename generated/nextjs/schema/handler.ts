// Schema — handler.ts
// Schema definition and management: define schemas with fields and types,
// validate data against schemas, support schema inheritance via parent chains.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SchemaStorage,
  SchemaDefineSchemaInput,
  SchemaDefineSchemaOutput,
  SchemaAddFieldInput,
  SchemaAddFieldOutput,
  SchemaExtendSchemaInput,
  SchemaExtendSchemaOutput,
  SchemaApplyToInput,
  SchemaApplyToOutput,
  SchemaRemoveFromInput,
  SchemaRemoveFromOutput,
  SchemaGetAssociationsInput,
  SchemaGetAssociationsOutput,
  SchemaExportInput,
  SchemaExportOutput,
} from './types.js';

import {
  defineSchemaOk,
  defineSchemaExists,
  addFieldOk,
  addFieldNotfound,
  extendSchemaOk,
  extendSchemaNotfound,
  applyToOk,
  applyToNotfound,
  removeFromOk,
  removeFromNotfound,
  getAssociationsOk,
  getAssociationsNotfound,
  exportOk,
  exportNotfound,
} from './types.js';

export interface SchemaError {
  readonly code: string;
  readonly message: string;
}

export interface SchemaHandler {
  readonly defineSchema: (
    input: SchemaDefineSchemaInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaDefineSchemaOutput>;
  readonly addField: (
    input: SchemaAddFieldInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaAddFieldOutput>;
  readonly extendSchema: (
    input: SchemaExtendSchemaInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaExtendSchemaOutput>;
  readonly applyTo: (
    input: SchemaApplyToInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaApplyToOutput>;
  readonly removeFrom: (
    input: SchemaRemoveFromInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaRemoveFromOutput>;
  readonly getAssociations: (
    input: SchemaGetAssociationsInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaGetAssociationsOutput>;
  readonly export: (
    input: SchemaExportInput,
    storage: SchemaStorage,
  ) => TE.TaskEither<SchemaError, SchemaExportOutput>;
}

const toSchemaError = (error: unknown): SchemaError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const schemaHandler: SchemaHandler = {
  defineSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.schema),
        toSchemaError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const fields = JSON.parse(input.fields) as readonly string[];
                  await storage.put('schemas', input.schema, {
                    name: input.schema,
                    fields: JSON.stringify(fields),
                    parent: null,
                    createdAt: new Date().toISOString(),
                  });
                  return defineSchemaOk();
                },
                toSchemaError,
              ),
            () => TE.right(defineSchemaExists(`Schema '${input.schema}' already exists`)),
          ),
        ),
      ),
    ),

  addField: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.schema),
        toSchemaError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(addFieldNotfound(`Schema '${input.schema}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const currentFields = JSON.parse((found as any).fields ?? '[]') as readonly string[];
                  const updatedFields = [...currentFields, input.field];
                  await storage.put('schemas', input.schema, {
                    ...found,
                    fields: JSON.stringify(updatedFields),
                  });
                  return addFieldOk();
                },
                toSchemaError,
              ),
          ),
        ),
      ),
    ),

  extendSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.parent),
        toSchemaError,
      ),
      TE.chain((parentRecord) =>
        pipe(
          O.fromNullable(parentRecord),
          O.fold(
            () => TE.right(extendSchemaNotfound(`Parent schema '${input.parent}' not found`)),
            (parentFound) =>
              pipe(
                TE.tryCatch(
                  () => storage.get('schemas', input.schema),
                  toSchemaError,
                ),
                TE.chain((childRecord) =>
                  pipe(
                    O.fromNullable(childRecord),
                    O.fold(
                      () => TE.right(extendSchemaNotfound(`Schema '${input.schema}' not found`)),
                      (childFound) =>
                        TE.tryCatch(
                          async () => {
                            await storage.put('schemas', input.schema, {
                              ...childFound,
                              parent: input.parent,
                            });
                            return extendSchemaOk();
                          },
                          toSchemaError,
                        ),
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  applyTo: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.schema),
        toSchemaError,
      ),
      TE.chain((schemaRecord) =>
        pipe(
          O.fromNullable(schemaRecord),
          O.fold(
            () => TE.right(applyToNotfound(`Schema '${input.schema}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  const associationKey = `${input.schema}::${input.entity}`;
                  await storage.put('schema_associations', associationKey, {
                    schema: input.schema,
                    entity: input.entity,
                    appliedAt: new Date().toISOString(),
                  });
                  return applyToOk();
                },
                toSchemaError,
              ),
          ),
        ),
      ),
    ),

  removeFrom: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => {
          const associationKey = `${input.schema}::${input.entity}`;
          return storage.get('schema_associations', associationKey);
        },
        toSchemaError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(removeFromNotfound(`Association between '${input.schema}' and '${input.entity}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  const associationKey = `${input.schema}::${input.entity}`;
                  await storage.delete('schema_associations', associationKey);
                  return removeFromOk();
                },
                toSchemaError,
              ),
          ),
        ),
      ),
    ),

  getAssociations: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.schema),
        toSchemaError,
      ),
      TE.chain((schemaRecord) =>
        pipe(
          O.fromNullable(schemaRecord),
          O.fold(
            () => TE.right(getAssociationsNotfound(`Schema '${input.schema}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  const associations = await storage.find('schema_associations', { schema: input.schema });
                  const entities = associations.map((a) => (a as any).entity as string);
                  return getAssociationsOk(JSON.stringify(entities));
                },
                toSchemaError,
              ),
          ),
        ),
      ),
    ),

  export: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('schemas', input.schema),
        toSchemaError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(exportNotfound(`Schema '${input.schema}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  const resolvedFields: string[] = [];
                  let current: Record<string, unknown> | null = found;
                  while (current !== null) {
                    const fields = JSON.parse((current as any).fields ?? '[]') as readonly string[];
                    resolvedFields.push(...fields);
                    const parentName = (current as any).parent as string | null;
                    current = parentName !== null
                      ? await storage.get('schemas', parentName)
                      : null;
                  }
                  const exported = {
                    name: (found as any).name,
                    fields: resolvedFields,
                    parent: (found as any).parent ?? null,
                  };
                  return exportOk(JSON.stringify(exported));
                },
                toSchemaError,
              ),
          ),
        ),
      ),
    ),
};
