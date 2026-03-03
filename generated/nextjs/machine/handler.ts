// Machine — handler.ts
// Surface concept: state machine for UI interactions.
// Defines states/transitions, validates event-driven transitions,
// tracks current state, and supports guard conditions on transitions.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MachineStorage,
  MachineSpawnInput,
  MachineSpawnOutput,
  MachineSendInput,
  MachineSendOutput,
  MachineConnectInput,
  MachineConnectOutput,
  MachineDestroyInput,
  MachineDestroyOutput,
} from './types.js';

import {
  spawnOk,
  spawnNotfound,
  spawnInvalid,
  sendOk,
  sendInvalid,
  sendGuarded,
  connectOk,
  connectNotfound,
  destroyOk,
  destroyNotfound,
} from './types.js';

export interface MachineError {
  readonly code: string;
  readonly message: string;
}

export interface MachineHandler {
  readonly spawn: (
    input: MachineSpawnInput,
    storage: MachineStorage,
  ) => TE.TaskEither<MachineError, MachineSpawnOutput>;
  readonly send: (
    input: MachineSendInput,
    storage: MachineStorage,
  ) => TE.TaskEither<MachineError, MachineSendOutput>;
  readonly connect: (
    input: MachineConnectInput,
    storage: MachineStorage,
  ) => TE.TaskEither<MachineError, MachineConnectOutput>;
  readonly destroy: (
    input: MachineDestroyInput,
    storage: MachineStorage,
  ) => TE.TaskEither<MachineError, MachineDestroyOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): MachineError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

interface MachineDefinition {
  readonly initial: string;
  readonly states: Record<string, {
    readonly on?: Record<string, {
      readonly target: string;
      readonly guard?: string;
    }>;
  }>;
}

/** Default machine definition for dialog-style widgets. */
const DEFAULT_DEFINITION: MachineDefinition = {
  initial: 'closed',
  states: {
    closed: {
      on: {
        OPEN: { target: 'open' },
      },
    },
    open: {
      on: {
        CLOSE: { target: 'closed' },
        SUBMIT: { target: 'submitted' },
      },
    },
    submitted: {
      on: {
        RESET: { target: 'closed' },
      },
    },
  },
};

const parseMachineContext = (context: string): E.Either<string, MachineDefinition> => {
  try {
    const parsed = JSON.parse(context);
    if (!parsed.initial || !parsed.states) {
      // Use default machine definition when not provided
      return E.right(DEFAULT_DEFINITION);
    }
    if (!(parsed.initial in parsed.states)) {
      return E.left(`Initial state "${parsed.initial}" is not defined in states`);
    }
    return E.right(parsed as MachineDefinition);
  } catch {
    return E.left('Machine context must be valid JSON with "initial" and "states" fields');
  }
};

// --- Implementation ---

export const machineHandler: MachineHandler = {
  spawn: (input, storage) =>
    pipe(
      // Validate the machine definition from context
      parseMachineContext(input.context),
      E.fold(
        (msg) => TE.right(spawnInvalid(msg)),
        (definition) =>
          TE.tryCatch(
            async () => {
              const defJson = JSON.stringify(definition);
              const instance = {
                machine: input.machine,
                widget: input.widget,
                definition: defJson,
                currentState: definition.initial,
                history: JSON.stringify([definition.initial]),
                createdAt: new Date().toISOString(),
              };
              await storage.put('machines', input.machine, instance);
              return spawnOk(input.machine);
            },
            mkStorageError,
          ),
      ),
    ),

  send: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('machines', input.machine),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(sendInvalid(`Machine "${input.machine}" not found`)),
            (found) => {
              const currentState = String(found['currentState'] ?? '');
              let definition: MachineDefinition;
              try {
                definition = JSON.parse(String(found['definition'] ?? '{}'));
              } catch {
                return TE.right(sendInvalid('Machine definition is corrupt'));
              }

              const stateConfig = definition.states[currentState];
              if (!stateConfig || !stateConfig.on) {
                return TE.right(
                  sendInvalid(`State "${currentState}" has no transitions defined`),
                );
              }

              // Parse event as JSON to extract type, or use raw string
              let eventName = input.event;
              try {
                const parsed = JSON.parse(input.event);
                if (typeof parsed === 'object' && parsed !== null && typeof parsed.type === 'string') {
                  eventName = parsed.type;
                }
              } catch {
                // Use raw event string
              }

              const transition = stateConfig.on[eventName];
              if (!transition) {
                return TE.right(
                  sendInvalid(
                    `No transition for event "${eventName}" in state "${currentState}"`,
                  ),
                );
              }

              // Check guard condition
              if (transition.guard) {
                return TE.right(sendGuarded(input.machine, transition.guard));
              }

              // Validate target state exists
              if (!(transition.target in definition.states)) {
                return TE.right(
                  sendInvalid(`Transition target "${transition.target}" is not a valid state`),
                );
              }

              // Apply transition
              const historyArr: string[] = JSON.parse(String(found['history'] ?? '[]'));
              const updatedHistory = [...historyArr, transition.target];

              return TE.tryCatch(
                async () => {
                  const updated = {
                    ...found,
                    currentState: transition.target,
                    history: JSON.stringify(updatedHistory),
                    lastEvent: input.event,
                    updatedAt: new Date().toISOString(),
                  };
                  await storage.put('machines', input.machine, updated);
                  return sendOk(input.machine, transition.target);
                },
                mkStorageError,
              );
            },
          ),
        ),
      ),
    ),

  connect: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('machines', input.machine),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(connectNotfound(`Machine "${input.machine}" not found`)),
            (found) => {
              const currentState = String(found['currentState'] ?? '');
              let definition: MachineDefinition;
              try {
                definition = JSON.parse(String(found['definition'] ?? '{}'));
              } catch {
                return TE.right(connectNotfound('Machine definition is corrupt'));
              }

              // Build props from current state configuration
              const stateConfig = definition.states[currentState];
              const availableEvents = stateConfig?.on ? Object.keys(stateConfig.on) : [];
              const props = {
                currentState,
                availableEvents,
                widget: String(found['widget'] ?? ''),
              };

              return TE.right(connectOk(input.machine, JSON.stringify(props)));
            },
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('machines', input.machine),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(destroyNotfound(`Machine "${input.machine}" not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('machines', input.machine);
                  return destroyOk(input.machine);
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),
};
