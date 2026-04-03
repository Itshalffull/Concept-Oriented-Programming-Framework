// @clef-handler style=functional concept=AllPassScorer
// ============================================================
// AllPassScorer Handler
//
// Default composite scorer: passes if and only if every check
// result in the results array has passed: true. Returns a score
// of 1.0 when all pass, 0.0 otherwise. Registers with
// PluginRegistry as a CompositeScorer provider.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'AllPassScorer';

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

    const total = results.length;
    const passCount = results.filter(r => r.passed === true).length;
    const failCount = total - passCount;
    const passed = failCount === 0;
    const score = passed ? 1.0 : 0.0;

    const details = JSON.stringify({
      scorer: PROVIDER_NAME,
      total,
      pass_count: passCount,
      fail_count: failCount,
      strategy: 'all-pass',
    });

    const p = createProgram();
    return complete(p, 'ok', { passed, score, details }) as StorageProgram<Result>;
  },
};

export const allPassScorerHandler = autoInterpret(_handler);

export default allPassScorerHandler;
