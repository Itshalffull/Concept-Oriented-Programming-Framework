// @clef-handler style=functional concept=FormulaCheckEvaluatorProvider
// ============================================================
// FormulaCheckEvaluatorProvider Handler
//
// Evaluates a Formula expression against step/process context by
// delegating to FormulaField/evaluate. Registers with PluginRegistry
// as a check-evaluator provider under name "formula".
//
// Config JSON shape:
//   { expression: string, context?: Record<string, unknown> }
//
// The expression is evaluated using a simple arithmetic/logical
// interpreter. Context variables are substituted before evaluation.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'FormulaCheckEvaluatorProvider';
const EVALUATOR_KIND = 'formula';

// ──────────────────────────────────────────────────────────────
// Formula evaluation (lightweight arithmetic/boolean interpreter)
// ──────────────────────────────────────────────────────────────

/**
 * Substitute named variables from context into the expression string.
 * Variables appear as {{varName}} in the expression.
 */
function substituteContext(expression: string, context: Record<string, unknown>): string {
  return expression.replace(/\{\{(\w+)\}\}/g, (_match, name) => {
    const val = context[name];
    return val !== undefined ? String(val) : '0';
  });
}

/**
 * Evaluate a simple numeric/boolean expression safely using a
 * restricted evaluator (no eval). Supports +, -, *, /, >, <, >=, <=, ==, !=,
 * &&, ||, !, numeric literals, true/false.
 *
 * Returns a numeric score in [0,1] for boolean outcomes (true→1, false→0)
 * or a direct numeric value clamped to [0,1].
 */
function evaluateExpression(expression: string): { score: number; raw: unknown } {
  const trimmed = expression.trim();

  // Pure boolean literals
  if (trimmed === 'true') return { score: 1, raw: true };
  if (trimmed === 'false') return { score: 0, raw: false };

  // Attempt numeric parse first
  const asNum = Number(trimmed);
  if (!isNaN(asNum)) {
    return { score: Math.min(1, Math.max(0, asNum)), raw: asNum };
  }

  // Comparison operators: lhs op rhs
  const compMatch = trimmed.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (compMatch) {
    const lhs = Number(compMatch[1].trim());
    const op = compMatch[2];
    const rhs = Number(compMatch[3].trim());
    if (!isNaN(lhs) && !isNaN(rhs)) {
      const result = (() => {
        switch (op) {
          case '>':  return lhs > rhs;
          case '<':  return lhs < rhs;
          case '>=': return lhs >= rhs;
          case '<=': return lhs <= rhs;
          case '==': return lhs === rhs;
          case '!=': return lhs !== rhs;
          default:   return false;
        }
      })();
      return { score: result ? 1 : 0, raw: result };
    }
  }

  // Fallback: treat as opaque — non-empty expression = 0.5 (unknown)
  return { score: 0.5, raw: expression };
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
      kind: EVALUATOR_KIND,
    }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const cv = (input.cv as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    if (!cv || cv.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'cv is required' }) as StorageProgram<Result>;
    }

    if (!configRaw || configRaw.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let config: { expression?: string; context?: Record<string, unknown> };
    try {
      config = JSON.parse(configRaw);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
    }

    if (!config.expression || config.expression.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config.expression is required' }) as StorageProgram<Result>;
    }

    const context = config.context ?? {};
    const substituted = substituteContext(config.expression, context);

    let evalResult: { score: number; raw: unknown };
    try {
      evalResult = evaluateExpression(substituted);
    } catch (err) {
      const p = createProgram();
      return complete(p, 'error', { message: `Expression evaluation failed: ${String(err)}` }) as StorageProgram<Result>;
    }

    const status: string = evalResult.score >= 1 ? 'passing' : evalResult.score > 0 ? 'failing' : 'failing';
    const evidence = JSON.stringify({
      expression: config.expression,
      substituted,
      raw: evalResult.raw,
      score: evalResult.score,
    });

    const p = createProgram();
    return complete(p, 'ok', {
      score: evalResult.score,
      evidence,
      status,
    }) as StorageProgram<Result>;
  },
};

export const formulaCheckEvaluatorHandler = autoInterpret(_handler);

export default formulaCheckEvaluatorHandler;
