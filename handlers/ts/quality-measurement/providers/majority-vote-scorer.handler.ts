// @clef-handler style=functional concept=MajorityVoteScorer
// ============================================================
// MajorityVoteScorer Handler
//
// Passes if at least N of M checks pass (majority vote). The
// minimum required pass count N is configurable; it defaults to
// a simple majority (floor(total / 2) + 1). The score is the
// ratio pass_count / total.
//
// Config JSON:
//   {
//     "min_pass": <N>,   // minimum checks that must pass (optional)
//     "threshold": 0.5   // alternative: pass ratio threshold (used when min_pass absent)
//   }
//
// If neither min_pass nor threshold is specified, defaults to
// simple majority: more than half must pass.
//
// Each result in the results array should have at minimum:
//   { "passed": true|false }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'MajorityVoteScorer';

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

    const total = results.length;
    const passCount = results.filter(r => r.passed === true).length;
    const failCount = total - passCount;
    const score = total > 0 ? passCount / total : 1.0;

    // Determine the required minimum pass count
    let minPass: number;
    if (typeof config.min_pass === 'number') {
      minPass = config.min_pass;
    } else if (typeof config.threshold === 'number') {
      minPass = Math.ceil(config.threshold * total);
    } else {
      // Default: simple majority
      minPass = Math.floor(total / 2) + 1;
    }

    const passed = passCount >= minPass;

    const details = JSON.stringify({
      scorer: PROVIDER_NAME,
      total,
      pass_count: passCount,
      fail_count: failCount,
      min_pass: minPass,
      strategy: 'majority-vote',
    });

    const p = createProgram();
    return complete(p, 'ok', { passed, score, details }) as StorageProgram<Result>;
  },
};

export const majorityVoteScorerHandler = autoInterpret(_handler);

export default majorityVoteScorerHandler;
