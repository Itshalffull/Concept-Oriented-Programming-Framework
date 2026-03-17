// ============================================================
// FunctionalConceptHandler — Handler Type for Monadic Programs
// ============================================================

import type { StorageProgram } from './storage-program.ts';

/**
 * A FunctionalConceptHandler produces StoragePrograms instead of
 * directly executing storage effects. Each action method takes input
 * and returns a StorageProgram describing the operations to perform.
 *
 * Note: no `storage` parameter. The handler never sees storage — it
 * only builds a program. The ProgramInterpreter executes it later.
 *
 * This type exists alongside the imperative ConceptHandler in types.ts.
 * Concepts can be migrated from imperative to functional one at a time.
 */
export interface FunctionalConceptHandler {
  [actionName: string]: (
    input: Record<string, unknown>,
  ) => StorageProgram<{ variant: string; [key: string]: unknown }>;
}

/**
 * Metadata about a registered functional handler.
 */
export interface FunctionalHandlerRegistration {
  /** Handler identifier. */
  id: string;
  /** Concept name this handler implements. */
  concept: string;
  /** Action name this handler implements. */
  action: string;
  /** Declared purity level. */
  purity: 'pure' | 'read-only' | 'read-write';
  /** The factory function that builds programs. */
  factory: (input: Record<string, unknown>) => StorageProgram<{ variant: string; [key: string]: unknown }>;
}
