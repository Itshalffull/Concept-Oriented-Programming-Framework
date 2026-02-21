// Formula Concept Implementation
// Evaluate reactive computed values derived from properties and relations,
// with dependency tracking and automatic invalidation.
import type { ConceptHandler } from '@copf/kernel';

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
    // Use word boundary matching to avoid partial replacements
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    resolved = resolved.replace(regex, String(value));
  }

  // Evaluate the arithmetic expression safely
  // Only allow numbers, operators, parentheses, and whitespace
  const sanitized = resolved.replace(/[^0-9+\-*/().%\s]/g, '');
  if (sanitized.trim().length === 0) {
    return 'computed';
  }

  try {
    // Use Function constructor for safe arithmetic evaluation
    const result = new Function(`return (${sanitized})`)();
    if (typeof result === 'number' && !isNaN(result)) {
      return String(result);
    }
    return 'computed';
  } catch {
    return 'computed';
  }
}

export const formulaHandler: ConceptHandler = {
  async create(input, storage) {
    const formula = input.formula as string;
    const expression = input.expression as string;

    const existing = await storage.get('formula', formula);
    if (existing) {
      return { variant: 'exists' };
    }

    const dependencies = extractDependencies(expression);
    const now = new Date().toISOString();

    await storage.put('formula', formula, {
      formula,
      expression,
      dependencies: JSON.stringify(dependencies),
      cachedResult: '',
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok' };
  },

  async evaluate(input, storage) {
    const formula = input.formula as string;

    const existing = await storage.get('formula', formula);
    if (!existing) {
      return { variant: 'notfound' };
    }

    const expression = existing.expression as string;
    const cachedResult = existing.cachedResult as string;

    // If there is a valid cached result, return it
    if (cachedResult && cachedResult !== '') {
      return { variant: 'ok', result: cachedResult };
    }

    // Evaluate the expression with an empty variable context
    // In a real system, variables would be resolved from related entities
    const variables: Record<string, number> = {};

    // Extract variable context if provided in input
    if (input.variables) {
      const vars = typeof input.variables === 'string'
        ? JSON.parse(input.variables as string)
        : input.variables as Record<string, number>;
      Object.assign(variables, vars);
    }

    const result = evaluateExpression(expression, variables);

    // Cache the result
    await storage.put('formula', formula, {
      ...existing,
      cachedResult: result,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', result };
  },

  async getDependencies(input, storage) {
    const formula = input.formula as string;

    const existing = await storage.get('formula', formula);
    if (!existing) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', deps: existing.dependencies as string };
  },

  async invalidate(input, storage) {
    const formula = input.formula as string;

    const existing = await storage.get('formula', formula);
    if (!existing) {
      return { variant: 'notfound' };
    }

    // Clear the cached result so it will be recomputed on next evaluation
    await storage.put('formula', formula, {
      ...existing,
      cachedResult: '',
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async setExpression(input, storage) {
    const formula = input.formula as string;
    const expression = input.expression as string;

    const existing = await storage.get('formula', formula);
    if (!existing) {
      return { variant: 'notfound' };
    }

    const dependencies = extractDependencies(expression);

    // Update expression, recalculate dependencies, and invalidate cache
    await storage.put('formula', formula, {
      ...existing,
      expression,
      dependencies: JSON.stringify(dependencies),
      cachedResult: '',
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },
};
