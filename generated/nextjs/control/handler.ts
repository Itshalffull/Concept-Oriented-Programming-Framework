// Control — handler.ts
// Surface concept: form control abstraction.
// Registers control types (text, select, checkbox), validates values
// against type constraints, serializes/deserializes control state.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ControlStorage,
  ControlCreateInput,
  ControlCreateOutput,
  ControlInteractInput,
  ControlInteractOutput,
  ControlGetValueInput,
  ControlGetValueOutput,
  ControlSetValueInput,
  ControlSetValueOutput,
  ControlTriggerActionInput,
  ControlTriggerActionOutput,
} from './types.js';

import {
  createOk,
  createExists,
  interactOk,
  interactNotfound,
  getValueOk,
  getValueNotfound,
  setValueOk,
  setValueNotfound,
  triggerActionOk,
  triggerActionNotfound,
} from './types.js';

export interface ControlError {
  readonly code: string;
  readonly message: string;
}

export interface ControlHandler {
  readonly create: (
    input: ControlCreateInput,
    storage: ControlStorage,
  ) => TE.TaskEither<ControlError, ControlCreateOutput>;
  readonly interact: (
    input: ControlInteractInput,
    storage: ControlStorage,
  ) => TE.TaskEither<ControlError, ControlInteractOutput>;
  readonly getValue: (
    input: ControlGetValueInput,
    storage: ControlStorage,
  ) => TE.TaskEither<ControlError, ControlGetValueOutput>;
  readonly setValue: (
    input: ControlSetValueInput,
    storage: ControlStorage,
  ) => TE.TaskEither<ControlError, ControlSetValueOutput>;
  readonly triggerAction: (
    input: ControlTriggerActionInput,
    storage: ControlStorage,
  ) => TE.TaskEither<ControlError, ControlTriggerActionOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): ControlError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const KNOWN_CONTROL_TYPES = ['text', 'number', 'select', 'checkbox', 'radio', 'textarea', 'date', 'toggle', 'slider', 'file'] as const;

const defaultValueForType = (type: string): string => {
  switch (type) {
    case 'checkbox':
    case 'toggle':
      return 'false';
    case 'number':
    case 'slider':
      return '0';
    default:
      return '';
  }
};

const validateValueForType = (value: string, type: string): E.Either<string, string> => {
  switch (type) {
    case 'number':
    case 'slider':
      return isNaN(Number(value))
        ? E.left(`Value "${value}" is not a valid number for control type "${type}"`)
        : E.right(value);
    case 'checkbox':
    case 'toggle':
      return value === 'true' || value === 'false'
        ? E.right(value)
        : E.left(`Value "${value}" must be "true" or "false" for control type "${type}"`);
    default:
      return E.right(value);
  }
};

// --- Implementation ---

export const controlHandler: ControlHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('controls', input.control),
        mkStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const record = {
                    control: input.control,
                    type: input.type,
                    binding: input.binding,
                    value: defaultValueForType(input.type),
                    dirty: false,
                    touched: false,
                    createdAt: new Date().toISOString(),
                  };
                  await storage.put('controls', input.control, record);
                  return createOk();
                },
                mkStorageError,
              ),
            () =>
              TE.right(
                createExists(`Control "${input.control}" already exists`),
              ),
          ),
        ),
      ),
    ),

  interact: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('controls', input.control),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                interactNotfound(`Control "${input.control}" not found`),
              ),
            (found) => {
              const controlType = String(found['type'] ?? 'text');

              // Parse the interaction input as an event
              let interactionEvent: Record<string, unknown>;
              try {
                interactionEvent = JSON.parse(input.input);
              } catch {
                interactionEvent = { type: 'change', value: input.input };
              }

              const newValue = String(interactionEvent['value'] ?? found['value'] ?? '');

              return pipe(
                validateValueForType(newValue, controlType),
                E.fold(
                  (validationError) =>
                    TE.right(interactOk(JSON.stringify({
                      status: 'rejected',
                      reason: validationError,
                      control: input.control,
                    }))),
                  (validValue) =>
                    TE.tryCatch(
                      async () => {
                        const updated = {
                          ...found,
                          value: validValue,
                          dirty: true,
                          touched: true,
                          lastInteraction: String(interactionEvent['type'] ?? 'change'),
                          updatedAt: new Date().toISOString(),
                        };
                        await storage.put('controls', input.control, updated);
                        return interactOk(JSON.stringify({
                          status: 'accepted',
                          value: validValue,
                          control: input.control,
                        }));
                      },
                      mkStorageError,
                    ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  getValue: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('controls', input.control),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                getValueNotfound(`Control "${input.control}" not found`),
              ),
            (found) =>
              TE.right(getValueOk(String(found['value'] ?? ''))),
          ),
        ),
      ),
    ),

  setValue: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('controls', input.control),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                setValueNotfound(`Control "${input.control}" not found`),
              ),
            (found) => {
              const controlType = String(found['type'] ?? 'text');

              return pipe(
                validateValueForType(input.value, controlType),
                E.fold(
                  (msg) =>
                    TE.left<ControlError>({ code: 'VALIDATION_ERROR', message: msg }),
                  (validValue) =>
                    TE.tryCatch(
                      async () => {
                        const updated = {
                          ...found,
                          value: validValue,
                          dirty: true,
                          updatedAt: new Date().toISOString(),
                        };
                        await storage.put('controls', input.control, updated);
                        return setValueOk();
                      },
                      mkStorageError,
                    ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  triggerAction: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('controls', input.control),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                triggerActionNotfound(`Control "${input.control}" not found`),
              ),
            (found) =>
              TE.tryCatch(
                async () => {
                  // Reset dirty flag after action is triggered (form submit semantics)
                  const updated = {
                    ...found,
                    dirty: false,
                    lastAction: new Date().toISOString(),
                  };
                  await storage.put('controls', input.control, updated);

                  const result = {
                    control: input.control,
                    binding: String(found['binding'] ?? ''),
                    value: String(found['value'] ?? ''),
                    type: String(found['type'] ?? ''),
                  };
                  return triggerActionOk(JSON.stringify(result));
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),
};
