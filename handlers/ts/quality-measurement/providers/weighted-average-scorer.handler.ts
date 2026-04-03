// @clef-handler style=functional concept=WeightedAverageScorer
// ============================================================
// WeightedAverageScorer Handler
//
// Computes a weighted average of check scores. Each check result
// can carry a weight; checks without an explicit weight use the
// default weight of 1.0. The weighted average is compared to a
// configurable threshold (default 0.7) to determine if the
// composite check passed.
//
// Config JSON:
//   {
//     "weights": { "<check_id>": <weight> },
//     "threshold": 0.7
//   }
//
// Each result in the results array should have:
//   { "id": "<check_id>", "passed": true|false, "score": 0.0-1.0 }
//
// If a result has no "score" field, it defaults to 1.0 if passed,
// 0.0 if failed.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'WeightedAverageScorer';

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

    const weights = (config.weights as Record<string, number>) ?? {};
    const threshold = typeof config.threshold === 'number' ? config.threshold : 0.7;

    if (results.length === 0) {
      const p = createProgram();
      return complete(p, 'ok', {
        passed: true,
        score: 1.0,
        details: JSON.stringify({ scorer: PROVIDER_NAME, total: 0, weighted_score: 1.0, threshold }),
      }) as StorageProgram<Result>;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const perCheck: Array<{ id: string; score: number; weight: number; passed: boolean }> = [];

    for (const r of results) {
      const id = (r.id as string) ?? '';
      const checkScore = typeof r.score === 'number' ? r.score : (r.passed === true ? 1.0 : 0.0);
      const weight = (id && typeof weights[id] === 'number') ? weights[id] : 1.0;
      weightedSum += checkScore * weight;
      totalWeight += weight;
      perCheck.push({ id, score: checkScore, weight, passed: r.passed === true });
    }

    const computedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = computedScore >= threshold;

    const details = JSON.stringify({
      scorer: PROVIDER_NAME,
      threshold,
      weighted_score: computedScore,
      total_weight: totalWeight,
      checks: perCheck,
    });

    const p = createProgram();
    return complete(p, 'ok', { passed, score: computedScore, details }) as StorageProgram<Result>;
  },
};

export const weightedAverageScorerHandler = autoInterpret(_handler);

export default weightedAverageScorerHandler;
