// Property — handler.ts
// Typed key-value metadata attached to content entities.
// Type definitions managed by TypeSystem; queries TypeSystem for
// type info via PropertyTypeResolution sync.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PropertyStorage,
  PropertySetInput,
  PropertySetOutput,
  PropertyGetInput,
  PropertyGetOutput,
  PropertyDeleteInput,
  PropertyDeleteOutput,
  PropertyListAllInput,
  PropertyListAllOutput,
} from './types.js';

import {
  setOk,
  setInvalid,
  getOk,
  getNotfound,
  deleteOk,
  deleteNotfound,
  listAllOk,
} from './types.js';

export interface PropertyError {
  readonly code: string;
  readonly message: string;
}

export interface PropertyHandler {
  readonly set: (
    input: PropertySetInput,
    storage: PropertyStorage,
  ) => TE.TaskEither<PropertyError, PropertySetOutput>;
  readonly get: (
    input: PropertyGetInput,
    storage: PropertyStorage,
  ) => TE.TaskEither<PropertyError, PropertyGetOutput>;
  readonly delete: (
    input: PropertyDeleteInput,
    storage: PropertyStorage,
  ) => TE.TaskEither<PropertyError, PropertyDeleteOutput>;
  readonly listAll: (
    input: PropertyListAllInput,
    storage: PropertyStorage,
  ) => TE.TaskEither<PropertyError, PropertyListAllOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): PropertyError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// Composite key for entity+property storage: "entity:key"
const propertyKey = (entity: string, key: string): string =>
  `${entity}:${key}`;

// Parse the properties map stored on an entity
const parseProperties = (raw: unknown): Record<string, string> => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return {};
};

// Basic type coercion validation. The key name heuristics determine type:
// keys ending in _number or _count expect numeric strings,
// keys ending in _bool or _flag expect "true"/"false",
// keys ending in _date expect ISO date strings.
const validatePropertyValue = (key: string, value: string): E.Either<string, string> => {
  const lowerKey = key.toLowerCase();

  if (lowerKey.endsWith('_number') || lowerKey.endsWith('_count')) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return E.left(`Value "${value}" is not a valid number for key "${key}"`);
    }
    return E.right(value);
  }

  if (lowerKey.endsWith('_bool') || lowerKey.endsWith('_flag')) {
    if (value !== 'true' && value !== 'false') {
      return E.left(`Value "${value}" is not a valid boolean for key "${key}"`);
    }
    return E.right(value);
  }

  if (lowerKey.endsWith('_date')) {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return E.left(`Value "${value}" is not a valid date for key "${key}"`);
    }
    return E.right(value);
  }

  // No type constraint — accept any value
  return E.right(value);
};

// --- Implementation ---

export const propertyHandler: PropertyHandler = {
  // Store a property value on the entity. Validates type constraints
  // based on key naming conventions. Returns invalid if validation fails.
  set: (input, storage) =>
    pipe(
      validatePropertyValue(input.key, input.value),
      E.fold(
        (validationError) =>
          TE.right<PropertyError, PropertySetOutput>(setInvalid(validationError)),
        (_validValue) =>
          pipe(
            TE.tryCatch(
              async () => {
                // Load or create the entity's property map
                const entityRecord = await storage.get('property_map', input.entity);
                const currentProps = entityRecord !== null
                  ? parseProperties(entityRecord.properties)
                  : {};

                const updatedProps = {
                  ...currentProps,
                  [input.key]: input.value,
                };

                await storage.put('property_map', input.entity, {
                  entity: input.entity,
                  properties: JSON.stringify(updatedProps),
                  updatedAt: nowISO(),
                });

                // Also store individual property for direct key lookup
                await storage.put('property', propertyKey(input.entity, input.key), {
                  entity: input.entity,
                  key: input.key,
                  value: input.value,
                  updatedAt: nowISO(),
                });

                return setOk(input.entity);
              },
              storageError,
            ),
          ),
      ),
    ),

  // Return the property value for the given entity and key.
  // Returns notfound if the property does not exist on this entity.
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('property', propertyKey(input.entity, input.key)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<PropertyError, PropertyGetOutput>(
              getNotfound(`Property "${input.key}" not found on entity ${input.entity}`),
            ),
            (found) => {
              const value = typeof found.value === 'string'
                ? found.value
                : String(found.value ?? '');
              return TE.right<PropertyError, PropertyGetOutput>(getOk(value));
            },
          ),
        ),
      ),
    ),

  // Remove the property from the entity.
  // Returns notfound if the property does not exist on this entity.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('property', propertyKey(input.entity, input.key)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<PropertyError, PropertyDeleteOutput>(
              deleteNotfound(`Property "${input.key}" not found on entity ${input.entity}`),
            ),
            () =>
              TE.tryCatch(
                async () => {
                  // Remove individual property record
                  await storage.delete('property', propertyKey(input.entity, input.key));

                  // Update the entity's property map
                  const entityRecord = await storage.get('property_map', input.entity);
                  if (entityRecord !== null) {
                    const currentProps = parseProperties(entityRecord.properties);
                    const { [input.key]: _removed, ...remaining } = currentProps;
                    await storage.put('property_map', input.entity, {
                      entity: input.entity,
                      properties: JSON.stringify(remaining),
                      updatedAt: nowISO(),
                    });
                  }

                  return deleteOk(input.entity);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Return all properties on the entity as a JSON string.
  listAll: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const entityRecord = await storage.get('property_map', input.entity);
          if (entityRecord === null) {
            return listAllOk(JSON.stringify({}));
          }

          const props = parseProperties(entityRecord.properties);
          return listAllOk(JSON.stringify(props));
        },
        storageError,
      ),
    ),
};
