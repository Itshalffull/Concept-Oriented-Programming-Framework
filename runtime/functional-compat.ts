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
import { interpret, type PerformHandler } from './interpreter.ts';
import { createInMemoryStorage } from './adapters/storage.ts';

/** Symbol used to attach a PerformHandler to an autoInterpret-wrapped handler. */
export const PERFORM_HANDLER = Symbol.for('clef:onPerform');

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
 *
 * To wire transport effects, set `handler[PERFORM_HANDLER] = myPerformFn`
 * before calling actions. The interpreter will call it for perform/performFrom
 * instructions. The handler itself never knows what's behind the callback —
 * it could be a sync engine, a direct function, or a concept chain.
 */
export function autoInterpret(handler: FunctionalConceptHandler): FunctionalConceptHandler & ConceptHandler {
  // Mutable slot for the perform handler — set externally via PERFORM_HANDLER symbol
  let onPerform: PerformHandler | undefined;

  return new Proxy(handler, {
    get(target, prop: string | symbol) {
      // Allow reading/writing the perform handler via symbol
      if (prop === PERFORM_HANDLER) return onPerform;

      const action = target[prop as string];
      if (typeof action !== 'function') return action;

      // Return a function that checks argument count at call time
      return function (...args: unknown[]) {
        const input = (args[0] ?? {}) as Record<string, unknown>;
        const storage = args[1] as ConceptStorage | undefined;
        const program = action.call(target, input);

        // If storage was passed, auto-interpret (imperative compat mode)
        if (storage !== undefined) {
          return interpret(program, storage, { onPerform }).then(result => ({
            variant: result.variant,
            ...result.output,
          }));
        }

        // If called with zero args and program is already terminated
        // (e.g. register()), auto-interpret with a no-op storage
        if (args.length === 0 && program && program.terminated) {
          return interpret(program, createInMemoryStorage(), { onPerform }).then(result => ({
            variant: result.variant,
            ...result.output,
          }));
        }

        // No storage — return the raw StorageProgram (functional mode)
        return program;
      };
    },
    set(_target, prop: string | symbol, value: unknown) {
      if (prop === PERFORM_HANDLER) {
        onPerform = value as PerformHandler | undefined;
        return true;
      }
      return false;
    },
  }) as FunctionalConceptHandler & ConceptHandler;
}
