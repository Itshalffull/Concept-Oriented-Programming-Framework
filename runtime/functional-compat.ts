// ============================================================
// FunctionalConceptHandler → ConceptHandler Compatibility Wrapper
//
// Wraps a FunctionalConceptHandler (returns StorageProgram) into
// a ConceptHandler (async methods with storage param) so that
// existing tests work without modification during the migration.
//
// Usage in tests:
//   import { wrapFunctional } from '@clef/runtime';
//   const handler = wrapFunctional(myFunctionalHandler);
//   const result = await handler.action(input, storage);
// ============================================================

import type { ConceptHandler, ConceptStorage } from './types.ts';
import type { FunctionalConceptHandler } from './functional-handler.ts';
import { interpret } from './interpreter.ts';

/**
 * Wrap a FunctionalConceptHandler as a ConceptHandler.
 *
 * Each action call builds the StorageProgram, interprets it against
 * the provided storage, and returns a flat result object with
 * { variant, ...output } matching the old imperative interface.
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
