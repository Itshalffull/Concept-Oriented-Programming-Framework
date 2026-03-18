// ============================================================
// FunctionalConceptHandler Compatibility Layer
//
// Provides two utilities:
//
// 1. wrapFunctional(handler) — creates a ConceptHandler wrapper
// 2. autoInterpret(handler) — creates a Proxy that auto-detects
//    whether the caller passes (input) or (input, storage) and
//    handles both styles transparently.
// ============================================================

import type { ConceptHandler, ConceptStorage } from './types.ts';
import type { FunctionalConceptHandler } from './functional-handler.ts';
import { interpret } from './interpreter.ts';

/**
 * Wrap a FunctionalConceptHandler as a ConceptHandler.
 */
export function wrapFunctional(handler: FunctionalConceptHandler): ConceptHandler {
  const wrapped: ConceptHandler = {};

  for (const actionName of Object.keys(handler)) {
    wrapped[actionName] = async (
      input: Record<string, unknown>,
      storage: ConceptStorage,
    ) => {
      const program = handler[actionName](input);
      const result = await interpret(program, storage);
      return { variant: result.variant, ...result.output };
    };
  }

  return wrapped;
}

/**
 * Create a Proxy around a FunctionalConceptHandler that auto-detects
 * the calling convention:
 *
 * - handler.action(input)         → returns StorageProgram (functional)
 * - handler.action(input, storage) → interprets and returns flat result (imperative compat)
 *
 * This allows a single export to serve both functional callers and
 * legacy imperative test code without any import changes.
 */
export function autoInterpret(handler: FunctionalConceptHandler): FunctionalConceptHandler & ConceptHandler {
  return new Proxy(handler, {
    get(target, prop: string) {
      const action = target[prop];
      if (typeof action !== 'function') return action;

      // Return a function that checks argument count at call time
      return function (input: Record<string, unknown>, storage?: ConceptStorage) {
        const program = action.call(target, input);

        // If storage was passed, auto-interpret (imperative compat mode)
        if (storage) {
          return interpret(program, storage).then(result => ({
            variant: result.variant,
            ...result.output,
          }));
        }

        // No storage — return the raw StorageProgram (functional mode)
        return program;
      };
    },
  }) as FunctionalConceptHandler & ConceptHandler;
}
