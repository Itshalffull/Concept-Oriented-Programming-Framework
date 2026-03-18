// ============================================================
// Test Helper — Invoke a handler action regardless of style
//
// Auto-detects whether a handler is functional (returns
// StorageProgram) or imperative (returns Promise<result>),
// and invokes accordingly.
// ============================================================

import type { ConceptStorage } from '../../runtime/types.ts';
import { interpret } from '../../runtime/interpreter.ts';

/**
 * Invoke a handler action, auto-detecting functional vs imperative style.
 *
 * Functional handlers return a StorageProgram (plain object with
 * `instructions` array). Imperative handlers return a Promise.
 */
export async function invokeAction(
  handler: Record<string, unknown>,
  action: string,
  input: Record<string, unknown>,
  storage: ConceptStorage,
): Promise<{ variant: string; [key: string]: unknown }> {
  const fn = handler[action] as Function;
  if (!fn) throw new Error(`Handler has no action "${action}"`);

  const result = fn(input, storage);

  // If result has `instructions` array, it's a StorageProgram — interpret it
  if (result && typeof result === 'object' && 'instructions' in result && Array.isArray(result.instructions)) {
    const execResult = await interpret(result, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // Otherwise it's an imperative handler returning a Promise or plain object
  const resolved = await result;
  return resolved as { variant: string; [key: string]: unknown };
}
