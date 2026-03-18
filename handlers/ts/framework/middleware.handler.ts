// @migrated dsl-constructs 2026-03-18
// ============================================================
// Middleware Concept Implementation
//
// Maps abstract interface traits to concrete middleware
// implementations per target. Manages trait definitions,
// per-target implementations, composition ordering, and
// compatibility rules.
// Architecture doc: Clef Bind, Section 1.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptStorage } from '../../../runtime/types.js';
import { randomUUID } from 'crypto';

/**
 * Numeric ordering for middleware positions. Lower values run first.
 */
const POSITION_ORDER: Record<string, number> = {
  'before-auth': 0,
  'auth': 1,
  'after-auth': 2,
  'validation': 3,
  'business-logic': 4,
  'serialization': 5,
};

/**
 * Validate that a position string is one of the known positions.
 */
function isValidPosition(position: string): boolean {
  return position in POSITION_ORDER;
}

const _handler: FunctionalConceptHandler = {
  /**
   * Register a trait-to-target middleware mapping.
   *
   * Stores the middleware record keyed by `{trait}:{target}`.
   * Returns `duplicateRegistration` if a mapping already exists
   * for that trait/target pair.
   */
  async register(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const trait = input.trait as string;
    const target = input.target as string;
    const implementation = input.implementation as string;
    const position = input.position as string;

    const compositeKey = `${trait}:${target}`;

    // Check for duplicate registration
    p = get(p, 'middleware', compositeKey, 'existing');
    if (existing) {
      p = complete(p, 'duplicateRegistration', { trait, target }); return p;
    }

    const middlewareId = randomUUID();

    p = put(p, 'middleware', compositeKey, {
      id: middlewareId,
      trait,
      target,
      implementation,
      position,
      positionOrder: POSITION_ORDER[position] ?? 999,
    });

    p = complete(p, 'ok', { middleware: middlewareId }); return p;
  },

  /**
   * Resolve an ordered list of middleware implementations for a
   * set of traits against a given target.
   *
   * For each trait, looks up the registered implementation. If any
   * trait has no registered implementation, returns `missingImplementation`.
   * Checks pairwise incompatibility rules stored in the
   * `incompatibility` relation. Returns the middleware list sorted
   * by position order.
   */
  async resolve(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const traits = input.traits as string[];
    const target = input.target as string;

    // Collect all middleware entries for the requested traits
    const entries: Array<{
      trait: string;
      implementation: string;
      position: string;
      positionOrder: number;
    }> = [];

    for (const trait of traits) {
      const compositeKey = `${trait}:${target}`;
      p = get(p, 'middleware', compositeKey, 'record');
      if (!record) {
        p = complete(p, 'missingImplementation', { trait, target }); return p;
      }
      entries.push({
        trait,
        implementation: record.implementation as string,
        position: record.position as string,
        positionOrder: (record.positionOrder as number) ?? 999,
      });
    }

    // Check pairwise incompatibility rules
    for (let i = 0; i < traits.length; i++) {
      for (let j = i + 1; j < traits.length; j++) {
        const ruleKey1 = `${traits[i]}:${traits[j]}`;
        const ruleKey2 = `${traits[j]}:${traits[i]}`;
        const rule =
          (await storage.get('incompatibility', ruleKey1)) ||
          (await storage.get('incompatibility', ruleKey2));
        if (rule) {
          p = complete(p, 'incompatibleTraits', { trait1: traits[i],
            trait2: traits[j],
            reason: rule.reason as string }); return p;
        }
      }
    }

    // Sort by position order
    entries.sort((a, b) => a.positionOrder - b.positionOrder);

    const middlewares = entries.map((e) => e.implementation);
    const order = entries.map((e) => e.positionOrder);

    p = complete(p, 'ok', { middlewares, order }); return p;
  },

  /**
   * Inject resolved middleware into generated output code.
   *
   * Wraps the output string with each middleware implementation
   * in sequence and returns the modified output with a count
   * of injected middleware layers.
   */
  async inject(
    input: Record<string, unknown>,
    storage: ConceptStorage,
  ) {
    let p = createProgram();
    const output = input.output as string;
    const middlewares = input.middlewares as string[];
    const target = input.target as string;

    let result = output;
    let injectedCount = 0;

    for (const mw of middlewares) {
      // Wrap the current output with the middleware layer
      result = `/* middleware:${mw} target:${target} */\n${mw}\n${result}\n/* end middleware:${mw} */`;
      injectedCount++;
    }

    p = complete(p, 'ok', { output: result, injectedCount }); return p;
  },
};

export const middlewareHandler = autoInterpret(_handler);
