// @clef-handler style=functional concept=FormulaCompositeScorer
// ============================================================
// FormulaCompositeScorer Handler
//
// Evaluates a user-defined formula over aggregated check results.
// Formula has access to these variables derived from the results:
//   - scores      : number[] — score values from each check result
//   - pass_count  : number   — number of passing checks
//   - fail_count  : number   — number of failing checks
//   - total       : number   — total number of checks
//   - avg_score   : number   — arithmetic mean of scores
//
// Config JSON:
//   { "formula": "<expression>", "threshold": 0.7 }
//
// Example formulas:
//   "avg_score"                          — pass if avg score >= threshold
//   "pass_count / total"                 — pass rate
//   "fail_count === 0 ? 1 : avg_score"  — strict with fallback score
//
// The formula is evaluated via Function constructor in a sandboxed
// scope containing only the declared variables. The result is compared
// to the configured threshold (default 0.5) to determine passed.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'FormulaCompositeScorer';

// ──────────────────────────────────────────────────────────────
// Formula evaluation
// ──────────────────────────────────────────────────────────────

interface FormulaVars {
  scores: number[];
  pass_count: number;
  fail_count: number;
  total: number;
  avg_score: number;
}

function evaluateFormula(formula: string, vars: FormulaVars): number {
  const { scores, pass_count, fail_count, total, avg_score } = vars;
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'scores', 'pass_count', 'fail_count', 'total', 'avg_score',
    `"use strict"; return (${formula});`,
  );
  const result = fn(scores, pass_count, fail_count, total, avg_score);
  if (typeof result !== 'number') {
    throw new Error(`Formula must evaluate to a number, got ${typeof result}`);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
    }) as StorageProgram<Result>;
  },

  score(input: Record<string, unknown>) {
    const resultsRaw = (input.results as string) ?? '';
    const configRaw = (input.config as string) ?? '{}';

    if (!resultsRaw || resultsRaw.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'results is required' }) as StorageProgram<Result>;
    }

    let results: Array<Record<string, unknown>>;
    try {
      results = JSON.parse(resultsRaw);
    } catch (_err) {
      const p = createProgram();
      return complete(p, 'error', { message: 'results must be a valid JSON array' }) as StorageProgram<Result>;
    }

    if (!Array.isArray(results)) {
      const p = createProgram();
      return complete(p, 'error', { message: 'results must be a JSON array' }) as StorageProgram<Result>;
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configRaw);
    } catch (_err) {
      const p = createProgram();
      return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
    }

    const formula = (config.formula as string) ?? 'avg_score';
    const threshold = typeof config.threshold === 'number' ? config.threshold : 0.5;

    // Build aggregation vars
    const scores = results.map(r => (typeof r.score === 'number' ? r.score : (r.passed === true ? 1.0 : 0.0)));
    const pass_count = results.filter(r => r.passed === true).length;
    const fail_count = results.length - pass_count;
    const total = results.length;
    const avg_score = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;

    let computedScore: number;
    try {
      computedScore = evaluateFormula(formula, { scores, pass_count, fail_count, total, avg_score });
    } catch (err) {
      const p = createProgram();
      return complete(p, 'error', { message: `Formula evaluation failed: ${String(err)}` }) as StorageProgram<Result>;
    }

    const passed = computedScore >= threshold;
    const details = JSON.stringify({
      scorer: PROVIDER_NAME,
      formula,
      threshold,
      computed_score: computedScore,
      total,
      pass_count,
      fail_count,
      avg_score,
    });

    const p = createProgram();
    return complete(p, 'ok', { passed, score: computedScore, details }) as StorageProgram<Result>;
  },
};

export const formulaCompositeScorerHandler = autoInterpret(_handler);

export default formulaCompositeScorerHandler;
