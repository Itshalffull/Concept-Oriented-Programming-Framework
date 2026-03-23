// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// FormulaSource Handler
//
// SlotSource provider that evaluates a formula expression against
// entity data. Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `fs-${++idCounter}`;
}

let registered = false;

/**
 * Evaluate a formula expression against entity data. Pure helper.
 */
function evaluateExpression(
  expression: string,
  entityData: Record<string, unknown>,
  formatPattern: string | undefined,
): { variant: string; [key: string]: unknown } {
  // Validate expression syntax
  const forbidden = /[;{}]|function\s|=>|import|require|eval|new\s+Function/;
  if (forbidden.test(expression)) {
    return {
      variant: 'parse_error',
      expression,
      message: 'Expression contains forbidden syntax',
    };
  }

  let result: string;
  try {
    let evaluable = expression;
    for (const [key, val] of Object.entries(entityData)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      evaluable = evaluable.replace(regex, String(val));
    }

    const numericOnly = /^[\d\s+\-*/().]+$/;
    if (numericOnly.test(evaluable)) {
      const computed = new Function(`"use strict"; return (${evaluable});`)();
      result = String(computed);
    } else {
      result = evaluable;
    }
  } catch (err) {
    return {
      variant: 'eval_error',
      expression,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (formatPattern && !isNaN(Number(result))) {
    const num = Number(result);
    if (formatPattern.startsWith('$')) {
      result = `$${num.toFixed(2)}`;
    } else if (formatPattern.includes('.')) {
      const decimals = (formatPattern.split('.')[1] || '').replace(/[^0#]/g, '').length;
      result = num.toFixed(decimals);
    }
  }

  return { variant: 'ok', data: result };
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'formula-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'formula' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const expression = input.expression as string;
    const entityId = input.entity_id as string;
    const formatPattern = input.format_pattern as string | undefined;
    const context = input.context as string;

    if (!expression) {
      const p = createProgram();
      return complete(p, 'error', { message: 'expression is required' }) as StorageProgram<Result>;
    }

    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
    }

    if (!entityId) {
      // No entity to look up, evaluate directly
      const evalResult = evaluateExpression(expression, {}, formatPattern);
      const p = createProgram();

      if (evalResult.variant !== 'ok') {
        return complete(p, evalResult.variant, evalResult) as StorageProgram<Result>;
      }

      const id = nextId();
      let prog = createProgram();
      prog = put(prog, 'formula-source', id, {
        id,
        expression,
        entity_id: entityId,
        format_pattern: formatPattern || null,
        result: evalResult.data,
        createdAt: new Date().toISOString(),
      });
      return complete(prog, 'ok', { data: evalResult.data }) as StorageProgram<Result>;
    }

    // Look up entity data
    const entityType = (parsedContext.entity_type as string) || 'entity';
    let p = createProgram();
    p = find(p, 'entity', { id: entityId }, 'entities');

    return completeFrom(p, 'dynamic', (bindings) => {
      const entities = bindings.entities as Record<string, unknown>[];
      let entityData: Record<string, unknown> = {};

      if (entities.length > 0) {
        entityData = entities[0];
      }

      const evalResult = evaluateExpression(expression, entityData, formatPattern);
      return evalResult;
    }) as StorageProgram<Result>;
  },
};

export const formulaSourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetFormulaSource(): void {
  idCounter = 0;
  registered = false;
}
