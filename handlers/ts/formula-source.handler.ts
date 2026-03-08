// ============================================================
// FormulaSource Handler
//
// SlotSource provider that evaluates a formula expression against
// entity data. Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `fs-${++idCounter}`;
}

let registered = false;

export const formulaSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('formula-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'formula' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const expression = input.expression as string;
    const entityId = input.entity_id as string;
    const formatPattern = input.format_pattern as string | undefined;
    const context = input.context as string;

    if (!expression) {
      return { variant: 'error', message: 'expression is required' };
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Validate expression syntax (basic check for unsafe patterns)
    const forbidden = /[;{}]|function\s|=>|import|require|eval|new\s+Function/;
    if (forbidden.test(expression)) {
      return {
        variant: 'parse_error',
        expression,
        message: 'Expression contains forbidden syntax',
      };
    }

    // Load entity data if entity_id is provided
    let entityData: Record<string, unknown> = {};
    if (entityId) {
      const entities = await storage.find('entity', { id: entityId });
      if (entities.length > 0) {
        entityData = entities[0] as Record<string, unknown>;
      } else {
        // Try looking up from context entity type
        const entityType = parsedContext.entity_type as string;
        if (entityType) {
          const entity = await storage.get(entityType, entityId);
          if (entity) {
            entityData = entity;
          }
        }
      }
    }

    // Evaluate the expression — in production this uses a safe expression
    // evaluator (e.g. mathjs or a sandboxed DSL). Here we do simple field
    // substitution and basic arithmetic.
    let result: string;
    try {
      // Replace field references with entity values
      let evaluable = expression;
      for (const [key, val] of Object.entries(entityData)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        evaluable = evaluable.replace(regex, String(val));
      }

      // Attempt numeric evaluation for simple arithmetic
      const numericOnly = /^[\d\s+\-*/().]+$/;
      if (numericOnly.test(evaluable)) {
        // Safe numeric evaluation via Function constructor with no scope
        const computed = new Function(`"use strict"; return (${evaluable});`)();
        result = String(computed);
      } else {
        // Return the substituted expression as-is
        result = evaluable;
      }
    } catch (err) {
      return {
        variant: 'eval_error',
        expression,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    // Apply format pattern if provided
    if (formatPattern && !isNaN(Number(result))) {
      const num = Number(result);
      if (formatPattern.startsWith('$')) {
        result = `$${num.toFixed(2)}`;
      } else if (formatPattern.includes('.')) {
        const decimals = (formatPattern.split('.')[1] || '').replace(/[^0#]/g, '').length;
        result = num.toFixed(decimals);
      }
    }

    const id = nextId();
    await storage.put('formula-source', id, {
      id,
      expression,
      entity_id: entityId,
      format_pattern: formatPattern || null,
      result,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data: result };
  },
};

/** Reset internal state. Useful for testing. */
export function resetFormulaSource(): void {
  idCounter = 0;
  registered = false;
}
