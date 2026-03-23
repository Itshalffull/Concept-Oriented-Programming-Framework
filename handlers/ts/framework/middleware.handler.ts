// @clef-handler style=functional
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
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

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

// Built-in trait implementations for common targets
const BUILTIN_MIDDLEWARE: Record<string, Record<string, { implementation: string; position: string }>> = {
  'auth:rest': { implementation: 'bearer-check', position: 'auth' },
  'auth:grpc': { implementation: 'grpc-auth-interceptor', position: 'auth' },
  'auth:graphql': { implementation: 'graphql-auth-directive', position: 'auth' },
  'auth:cli': { implementation: 'cli-auth-check', position: 'auth' },
  'auth:mcp': { implementation: 'mcp-auth-check', position: 'auth' },
  'validation:rest': { implementation: 'zod-body-validator', position: 'validation' },
  'validation:grpc': { implementation: 'grpc-proto-validator', position: 'validation' },
  'validation:graphql': { implementation: 'graphql-input-validator', position: 'validation' },
  'validation:cli': { implementation: 'cli-arg-validator', position: 'validation' },
  'logging:rest': { implementation: 'http-logger', position: 'before-auth' },
  'logging:grpc': { implementation: 'grpc-logger', position: 'before-auth' },
  'rate-limiting:rest': { implementation: 'express-rate-limit', position: 'before-auth' },
  'cors:rest': { implementation: 'cors-handler', position: 'before-auth' },
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
  register(input: Record<string, unknown>) {
    if (!input.trait || (typeof input.trait === 'string' && (input.trait as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'trait is required' }) as StorageProgram<Result>;
    }
    const trait = input.trait as string;
    const target = input.target as string;
    const implementation = input.implementation as string;
    const position = input.position as string;

    const compositeKey = `${trait}:${target}`;
    const middlewareId = randomUUID();

    let p = createProgram();
    // Check for duplicate registration
    p = get(p, 'middleware', compositeKey, 'existing');
    p = branch(p, 'existing',
      // then: duplicate found
      (tp) => complete(tp, 'duplicateRegistration', { trait, target }),
      // else: register new
      (ep) => {
        let q = put(ep, 'middleware', compositeKey, {
          id: middlewareId,
          trait,
          target,
          implementation,
          position,
          positionOrder: POSITION_ORDER[position] ?? 999,
        });
        return complete(q, 'ok', { middleware: middlewareId });
      },
    );
    return p;
  },

  /**
   * Resolve an ordered list of middleware implementations for a
   * set of traits against a given target.
   *
   * Uses find() to load all middleware records then mapBindings()
   * to compute the resolved list, checking for missing implementations
   * and incompatibility rules.
   */
  resolve(input: Record<string, unknown>) {
    // traits can be a string (JSON array) or an actual array
    let traitsRaw = input.traits;
    if (typeof traitsRaw === 'string') {
      try {
        traitsRaw = JSON.parse(traitsRaw);
      } catch {
        // treat as single trait in array
        traitsRaw = [traitsRaw];
      }
    }
    if (!traitsRaw || !Array.isArray(traitsRaw) || (traitsRaw as string[]).length === 0) {
      return complete(createProgram(), 'error', { message: 'traits is required' }) as StorageProgram<Result>;
    }
    const traits = traitsRaw as string[];
    const target = input.target as string;

    // Load all middleware and incompatibility records
    let p = createProgram();
    p = find(p, 'middleware', {}, 'allMiddleware');
    p = find(p, 'incompatibility', {}, 'allIncompat');
    p = completeFrom(p, 'ok', (bindings) => {
      const allMiddleware = bindings.allMiddleware as Record<string, unknown>[];
      const allIncompat = bindings.allIncompat as Record<string, unknown>[];

      // Collect entries for requested traits
      const entries: Array<{ trait: string; implementation: string; position: string; positionOrder: number }> = [];
      for (const trait of traits) {
        // Check storage first, then built-in map
        const record = allMiddleware.find((m) => m.trait === trait && m.target === target);
        if (record) {
          entries.push({
            trait,
            implementation: record.implementation as string,
            position: record.position as string,
            positionOrder: (record.positionOrder as number) ?? 999,
          });
        } else {
          const builtinKey = `${trait}:${target}`;
          const builtin = BUILTIN_MIDDLEWARE[builtinKey];
          if (builtin) {
            entries.push({
              trait,
              implementation: builtin.implementation,
              position: builtin.position,
              positionOrder: POSITION_ORDER[builtin.position] ?? 999,
            });
          } else {
            return { variant: 'missingImplementation', trait, target };
          }
        }
      }

      // Check pairwise incompatibility
      for (let i = 0; i < traits.length; i++) {
        for (let j = i + 1; j < traits.length; j++) {
          const rule = allIncompat.find((r) => {
            const a = r.trait1 as string; const b = r.trait2 as string;
            return (a === traits[i] && b === traits[j]) || (a === traits[j] && b === traits[i]);
          });
          if (rule) {
            return { variant: 'incompatibleTraits', trait1: traits[i], trait2: traits[j], reason: rule.reason as string };
          }
        }
      }

      entries.sort((a, b) => a.positionOrder - b.positionOrder);
      return { middlewares: entries.map((e) => e.implementation), order: entries.map((e) => e.positionOrder) };
    });
    return p;
  },

  /**
   * Inject resolved middleware into generated output code.
   * Pure computation - no storage needed.
   */
  inject(input: Record<string, unknown>) {
    if (input.output === undefined || input.output === null || input.output === '') {
      return complete(createProgram(), 'error', { message: 'output is required' }) as StorageProgram<Result>;
    }
    const output = input.output as string;
    // middlewares can be string (JSON) or array
    let middlewaresRaw = input.middlewares;
    if (typeof middlewaresRaw === 'string') {
      try {
        middlewaresRaw = JSON.parse(middlewaresRaw);
      } catch {
        middlewaresRaw = [middlewaresRaw];
      }
    }
    if (!middlewaresRaw || !Array.isArray(middlewaresRaw)) {
      return complete(createProgram(), 'error', { message: 'middlewares is required' }) as StorageProgram<Result>;
    }
    const middlewares = middlewaresRaw as string[];
    const target = input.target as string;

    let result = output;
    let injectedCount = 0;

    for (const mw of middlewares) {
      result = `/* middleware:${mw} target:${target} */\n${mw}\n${result}\n/* end middleware:${mw} */`;
      injectedCount++;
    }

    let p = createProgram();
    p = complete(p, 'ok', { output: result, injectedCount });
    return p;
  },
};

export const middlewareHandler = autoInterpret(_handler);
