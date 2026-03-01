// Workflow — State machine workflow engine
// Defines states and transitions with guards, validates transition legality,
// executes transitions atomically, and tracks entity state history.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WorkflowStorage,
  WorkflowDefineStateInput,
  WorkflowDefineStateOutput,
  WorkflowDefineTransitionInput,
  WorkflowDefineTransitionOutput,
  WorkflowTransitionInput,
  WorkflowTransitionOutput,
  WorkflowGetCurrentStateInput,
  WorkflowGetCurrentStateOutput,
} from './types.js';

import {
  defineStateOk,
  defineStateExists,
  defineTransitionOk,
  defineTransitionError,
  transitionOk,
  transitionNotfound,
  transitionForbidden,
  getCurrentStateOk,
  getCurrentStateNotfound,
} from './types.js';

export interface WorkflowError {
  readonly code: string;
  readonly message: string;
}

export interface WorkflowHandler {
  readonly defineState: (
    input: WorkflowDefineStateInput,
    storage: WorkflowStorage,
  ) => TE.TaskEither<WorkflowError, WorkflowDefineStateOutput>;
  readonly defineTransition: (
    input: WorkflowDefineTransitionInput,
    storage: WorkflowStorage,
  ) => TE.TaskEither<WorkflowError, WorkflowDefineTransitionOutput>;
  readonly transition: (
    input: WorkflowTransitionInput,
    storage: WorkflowStorage,
  ) => TE.TaskEither<WorkflowError, WorkflowTransitionOutput>;
  readonly getCurrentState: (
    input: WorkflowGetCurrentStateInput,
    storage: WorkflowStorage,
  ) => TE.TaskEither<WorkflowError, WorkflowGetCurrentStateOutput>;
}

const storageError = (error: unknown): WorkflowError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Composite key builders for storage
const stateKey = (workflow: string, name: string): string =>
  `${workflow}::state::${name}`;

const transitionKey = (workflow: string, label: string): string =>
  `${workflow}::transition::${label}`;

const entityKey = (workflow: string, entity: string): string =>
  `${workflow}::entity::${entity}`;

// --- Implementation ---

export const workflowHandler: WorkflowHandler = {
  // Define a named state within a workflow. Flags encode properties
  // like "initial", "terminal", etc. Rejects duplicates.
  defineState: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('workflow_states', stateKey(input.workflow, input.name)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('workflow_states', stateKey(input.workflow, input.name), {
                    workflow: input.workflow,
                    name: input.name,
                    flags: input.flags,
                    createdAt: new Date().toISOString(),
                  });
                  return defineStateOk();
                },
                storageError,
              ),
            () =>
              TE.right(defineStateExists(
                `State '${input.name}' already exists in workflow '${input.workflow}'`,
              )),
          ),
        ),
      ),
    ),

  // Define a labeled transition between two states with an optional guard expression.
  // Both the source and target states must already be defined.
  defineTransition: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('workflow_states', stateKey(input.workflow, input.from)),
        storageError,
      ),
      TE.chain((fromState) =>
        pipe(
          O.fromNullable(fromState),
          O.fold(
            () =>
              TE.right(defineTransitionError(
                `Source state '${input.from}' does not exist in workflow '${input.workflow}'`,
              )),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.get('workflow_states', stateKey(input.workflow, input.to)),
                  storageError,
                ),
                TE.chain((toState) =>
                  pipe(
                    O.fromNullable(toState),
                    O.fold(
                      () =>
                        TE.right(defineTransitionError(
                          `Target state '${input.to}' does not exist in workflow '${input.workflow}'`,
                        )),
                      () =>
                        TE.tryCatch(
                          async () => {
                            await storage.put(
                              'workflow_transitions',
                              transitionKey(input.workflow, input.label),
                              {
                                workflow: input.workflow,
                                from: input.from,
                                to: input.to,
                                label: input.label,
                                guard: input.guard,
                                createdAt: new Date().toISOString(),
                              },
                            );
                            return defineTransitionOk();
                          },
                          storageError,
                        ),
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  // Execute a named transition for an entity. Validates that the transition
  // exists, that the entity is currently in the transition's source state,
  // then moves the entity to the target state and records history.
  transition: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('workflow_transitions', transitionKey(input.workflow, input.transition)),
        storageError,
      ),
      TE.chain((transRecord) =>
        pipe(
          O.fromNullable(transRecord),
          O.fold(
            () =>
              TE.right(transitionNotfound(
                `Transition '${input.transition}' not found in workflow '${input.workflow}'`,
              )),
            (trans) => {
              const transData = trans as Record<string, unknown>;
              const fromState = String(transData.from ?? '');
              const toState = String(transData.to ?? '');

              return pipe(
                TE.tryCatch(
                  () => storage.get('workflow_entities', entityKey(input.workflow, input.entity)),
                  storageError,
                ),
                TE.chain((entityRecord) => {
                  const currentState = entityRecord
                    ? String((entityRecord as Record<string, unknown>).currentState ?? '')
                    : '';

                  // If entity has no state yet, only allow transitions from an initial state
                  if (!entityRecord && fromState !== '') {
                    return TE.right(transitionForbidden(
                      `Entity '${input.entity}' has no current state; transition '${input.transition}' requires state '${fromState}'`,
                    ));
                  }

                  // Verify the entity is in the expected source state
                  if (entityRecord && currentState !== fromState) {
                    return TE.right(transitionForbidden(
                      `Entity '${input.entity}' is in state '${currentState}', but transition '${input.transition}' requires '${fromState}'`,
                    ));
                  }

                  const now = new Date().toISOString();
                  const historyVersion = entityRecord
                    ? (typeof (entityRecord as Record<string, unknown>).historyVersion === 'number'
                      ? ((entityRecord as Record<string, unknown>).historyVersion as number) + 1
                      : 1)
                    : 1;

                  return TE.tryCatch(
                    async () => {
                      // Update entity's current state
                      await storage.put('workflow_entities', entityKey(input.workflow, input.entity), {
                        workflow: input.workflow,
                        entity: input.entity,
                        currentState: toState,
                        previousState: currentState || null,
                        lastTransition: input.transition,
                        historyVersion,
                        updatedAt: now,
                      });

                      // Append to transition history
                      const historyKey = `${input.workflow}::${input.entity}::${historyVersion}`;
                      await storage.put('workflow_history', historyKey, {
                        workflow: input.workflow,
                        entity: input.entity,
                        from: fromState,
                        to: toState,
                        transition: input.transition,
                        version: historyVersion,
                        timestamp: now,
                      });

                      return transitionOk(toState);
                    },
                    storageError,
                  );
                }),
              );
            },
          ),
        ),
      ),
    ),

  // Retrieve the current state of an entity within a workflow.
  getCurrentState: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('workflow_entities', entityKey(input.workflow, input.entity)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(getCurrentStateNotfound(
                `Entity '${input.entity}' not found in workflow '${input.workflow}'`,
              )),
            (found) =>
              TE.right(getCurrentStateOk(
                String((found as Record<string, unknown>).currentState ?? ''),
              )),
          ),
        ),
      ),
    ),
};
