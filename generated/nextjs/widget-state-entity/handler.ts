// WidgetStateEntity — Widget state machine instances, dirty tracking, and reachability analysis
// Manages state definitions per widget, transition graph analysis, and event tracing.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetStateEntityStorage,
  WidgetStateEntityRegisterInput,
  WidgetStateEntityRegisterOutput,
  WidgetStateEntityFindByWidgetInput,
  WidgetStateEntityFindByWidgetOutput,
  WidgetStateEntityReachableFromInput,
  WidgetStateEntityReachableFromOutput,
  WidgetStateEntityUnreachableStatesInput,
  WidgetStateEntityUnreachableStatesOutput,
  WidgetStateEntityTraceEventInput,
  WidgetStateEntityTraceEventOutput,
  WidgetStateEntityGetInput,
  WidgetStateEntityGetOutput,
} from './types.js';

import {
  registerOk,
  findByWidgetOk,
  reachableFromOk,
  unreachableStatesOk,
  traceEventOk,
  traceEventUnhandled,
  getOk,
  getNotfound,
} from './types.js';

export interface WidgetStateEntityError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetStateEntityHandler {
  readonly register: (
    input: WidgetStateEntityRegisterInput,
    storage: WidgetStateEntityStorage,
  ) => TE.TaskEither<WidgetStateEntityError, WidgetStateEntityRegisterOutput>;
  readonly findByWidget: (
    input: WidgetStateEntityFindByWidgetInput,
    storage: WidgetStateEntityStorage,
  ) => TE.TaskEither<WidgetStateEntityError, WidgetStateEntityFindByWidgetOutput>;
  readonly reachableFrom: (
    input: WidgetStateEntityReachableFromInput,
    storage: WidgetStateEntityStorage,
  ) => TE.TaskEither<WidgetStateEntityError, WidgetStateEntityReachableFromOutput>;
  readonly unreachableStates: (
    input: WidgetStateEntityUnreachableStatesInput,
    storage: WidgetStateEntityStorage,
  ) => TE.TaskEither<WidgetStateEntityError, WidgetStateEntityUnreachableStatesOutput>;
  readonly traceEvent: (
    input: WidgetStateEntityTraceEventInput,
    storage: WidgetStateEntityStorage,
  ) => TE.TaskEither<WidgetStateEntityError, WidgetStateEntityTraceEventOutput>;
  readonly get: (
    input: WidgetStateEntityGetInput,
    storage: WidgetStateEntityStorage,
  ) => TE.TaskEither<WidgetStateEntityError, WidgetStateEntityGetOutput>;
}

// --- Helpers ---

const toError = (error: unknown): WidgetStateEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a stable state ID from widget and state name. */
const makeStateId = (widget: string, name: string): string =>
  `${widget}::${name}`;

/** BFS reachability from a start state through the transition graph. */
const computeReachable = (
  startState: string,
  transitions: readonly Record<string, unknown>[],
): { readonly reachable: readonly string[]; readonly via: readonly string[] } => {
  const visited = new Set<string>();
  const transitionNames: string[] = [];
  const queue: string[] = [startState];
  visited.add(startState);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of transitions) {
      if (String(t['from'] ?? '') === current) {
        const target = String(t['to'] ?? '');
        const transName = String(t['event'] ?? '');
        if (!visited.has(target)) {
          visited.add(target);
          queue.push(target);
          transitionNames.push(transName);
        }
      }
    }
  }
  // Remove the start state from the reachable set
  visited.delete(startState);
  return {
    reachable: [...visited],
    via: transitionNames,
  };
};

// --- Implementation ---

export const widgetStateEntityHandler: WidgetStateEntityHandler = {
  // Register a new state definition for a widget with its initial value
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const stateId = makeStateId(input.widget, input.name);
          await storage.put('widget_state', stateId, {
            stateId,
            widget: input.widget,
            name: input.name,
            initial: input.initial,
            registeredAt: new Date().toISOString(),
          });
          return registerOk(stateId);
        },
        toError,
      ),
    ),

  // Find all state definitions belonging to a specific widget
  findByWidget: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allStates = await storage.find('widget_state', { widget: input.widget });
          const stateIds = allStates.map((s) => String(s['stateId'] ?? ''));
          return findByWidgetOk(JSON.stringify(stateIds));
        },
        toError,
      ),
    ),

  // Compute all states reachable from a given start state via BFS
  reachableFrom: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const stateRecord = await storage.get('widget_state', input.widgetState);
          if (stateRecord === null) {
            return reachableFromOk(JSON.stringify([]), JSON.stringify([]));
          }
          const widget = String(stateRecord['widget'] ?? '');
          const transitions = await storage.find('widget_transition', { widget });
          const result = computeReachable(input.widgetState, transitions);
          return reachableFromOk(
            JSON.stringify(result.reachable),
            JSON.stringify(result.via),
          );
        },
        toError,
      ),
    ),

  // Find states in a widget that are unreachable from the initial state
  unreachableStates: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allStates = await storage.find('widget_state', { widget: input.widget });
          const transitions = await storage.find('widget_transition', { widget: input.widget });
          // Find the initial state (the one marked initial=true or the first registered)
          const initialState = allStates.find((s) => String(s['initial'] ?? '') === 'true');
          const startId = initialState !== undefined
            ? String(initialState['stateId'] ?? '')
            : (allStates.length > 0 ? String(allStates[0]['stateId'] ?? '') : '');
          if (startId === '') {
            const allIds = allStates.map((s) => String(s['stateId'] ?? ''));
            return unreachableStatesOk(JSON.stringify(allIds));
          }
          const { reachable } = computeReachable(startId, transitions);
          const reachableSet = new Set([startId, ...reachable]);
          const unreachable = allStates
            .map((s) => String(s['stateId'] ?? ''))
            .filter((id) => !reachableSet.has(id));
          return unreachableStatesOk(JSON.stringify(unreachable));
        },
        toError,
      ),
    ),

  // Trace which transition paths an event triggers, or report if unhandled in some states
  traceEvent: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allStates = await storage.find('widget_state', { widget: input.widget });
          const transitions = await storage.find('widget_transition', { widget: input.widget });
          const matchingTransitions = transitions.filter(
            (t) => String(t['event'] ?? '') === input.event,
          );
          if (matchingTransitions.length === 0) {
            const allStateIds = allStates.map((s) => String(s['stateId'] ?? ''));
            return traceEventUnhandled(JSON.stringify(allStateIds));
          }
          // Check which states handle this event
          const handledFromStates = new Set(matchingTransitions.map((t) => String(t['from'] ?? '')));
          const unhandledStates = allStates
            .map((s) => String(s['stateId'] ?? ''))
            .filter((id) => !handledFromStates.has(id));
          if (unhandledStates.length > 0) {
            return traceEventUnhandled(JSON.stringify(unhandledStates));
          }
          const paths = matchingTransitions.map((t) => ({
            from: String(t['from'] ?? ''),
            to: String(t['to'] ?? ''),
            event: input.event,
          }));
          return traceEventOk(JSON.stringify(paths));
        },
        toError,
      ),
    ),

  // Get full details of a specific widget state
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('widget_state', input.widgetState),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound() as WidgetStateEntityGetOutput),
            (found) =>
              TE.tryCatch(
                async () => {
                  const widget = String(found['widget'] ?? '');
                  const transitions = await storage.find('widget_transition', {
                    widget,
                    from: input.widgetState,
                  });
                  return getOk(
                    String(found['stateId'] ?? input.widgetState),
                    widget,
                    String(found['name'] ?? ''),
                    String(found['initial'] ?? 'false'),
                    transitions.length,
                  );
                },
                toError,
              ),
          ),
        ),
      ),
    ),
};
