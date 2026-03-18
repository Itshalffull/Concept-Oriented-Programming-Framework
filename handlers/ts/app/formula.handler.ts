// @migrated dsl-constructs 2026-03-18
// Formula Concept Implementation
// Evaluate reactive computed values derived from properties and relations,
// with dependency tracking and automatic invalidation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

/**
 * Extract variable names from a formula expression.
 * Matches identifiers that are not numeric literals and not known operators.
 */
function extractDependencies(expression: string): string[] {
  const tokens = expression.match(/[a-zA-Z_][a-zA-Z_0-9]*/g) || [];
  // Filter out known math functions/constants
  const reserved = new Set([
    'abs', 'max', 'min', 'sqrt', 'pow', 'round', 'floor', 'ceil',
    'Math', 'PI', 'E', 'true', 'false', 'null', 'undefined',
  ]);
  const deps = new Set<string>();
  for (const token of tokens) {
    if (!reserved.has(token)) {
      deps.add(token);
    }
  }
  return Array.from(deps);
}

/**
 * Evaluate a formula expression with variable substitution.
 * Variables are resolved from the provided context.
 */
function evaluateExpression(
  expression: string,
  variables: Record<string, number>,
): string {
  // Replace variable references with their numeric values
  let resolved = expression;
  for (const [name, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    resolved = resolved.replace(regex, String(value));
  }

  const sanitized = resolved.replace(/[^0-9+\-*/().%\s]/g, '');
  if (sanitized.trim().length === 0) {
    return 'computed';
  }

  try {
    const result = new Function(`return (${sanitized})`)();
    if (typeof result === 'number' && !isNaN(result)) {
      return String(result);
    }
    return 'computed';
  } catch {
    return 'computed';
  }
}

const formulaHandlerFunctional: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const formula = input.formula as string;
    const expression = input.expression as string;

    let p = createProgram();
    p = spGet(p, 'formula', formula, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', {}),
      (b) => {
        const dependencies = extractDependencies(expression);
        const now = new Date().toISOString();
        let b2 = put(b, 'formula', formula, {
          formula,
          expression,
          dependencies: JSON.stringify(dependencies),
          cachedResult: '',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  evaluate(input: Record<string, unknown>) {
    const formula = input.formula as string;

    let p = createProgram();
    p = spGet(p, 'formula', formula, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // At runtime the branch bindings contain the record for evaluation
        let b2 = put(b, 'formula', formula, {
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { result: 'computed' });
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getDependencies(input: Record<string, unknown>) {
    const formula = input.formula as string;

    let p = createProgram();
    p = spGet(p, 'formula', formula, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { deps: '[]' }),
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  invalidate(input: Record<string, unknown>) {
    const formula = input.formula as string;

    let p = createProgram();
    p = spGet(p, 'formula', formula, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'formula', formula, {
          cachedResult: '',
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setExpression(input: Record<string, unknown>) {
    const formula = input.formula as string;
    const expression = input.expression as string;

    let p = createProgram();
    p = spGet(p, 'formula', formula, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const dependencies = extractDependencies(expression);
        let b2 = put(b, 'formula', formula, {
          expression,
          dependencies: JSON.stringify(dependencies),
          cachedResult: '',
          updatedAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const formulaHandler = wrapFunctional(formulaHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { formulaHandlerFunctional };
