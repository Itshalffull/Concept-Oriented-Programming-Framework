// @clef-handler style=functional concept=OpenSSFScorecardProvider
// ============================================================
// OpenSSFScorecardProvider Handler
//
// SupplyChainQuality provider that fetches OpenSSF Scorecard
// results for a repository or npm package and maps the scores
// to Clef supply-chain metrics. Flags dependencies with low
// individual check scores as risks.
//
// OpenSSF Scorecard REST API:
//   GET https://api.securityscorecards.dev/projects/{platform}/{org}/{repo}
//   Response: { score: number, checks: Array<{ name, score, reason }> }
//
// Risk classification (per check score):
//   score >= 8 → low
//   score >= 5 → medium
//   score >= 2 → high
//   score <  2 → critical
//
// Inputs (scan):
//   target  — repository URL (e.g. "github.com/expressjs/express")
//             or npm package name (e.g. "express") resolved to
//             its source repository via the npm registry API
//   config  — JSON string with optional settings:
//             {
//               minScore?:       number,   // flag checks below this (default: 5)
//               platform?:       string,   // default: "github.com"
//               includeChecks?:  string[]  // filter to specific check names
//             }
//
// Output (scan ok):
//   scores — JSON-stringified array of check results:
//            Array<{ check, score, reason, riskLevel }>
//   risks  — JSON-stringified array of low-scoring checks:
//            Array<{ check, score, reason, riskLevel }>
//
// Perform contract (http):
//   endpoint: "openssf-scorecard-api"
//   method:   "GET"
//   path:     /projects/{platform}/{repo}
//   returns:  { score, checks: Array<{ name, score, reason }> }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, perform, branch,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'OpenSSFScorecardProvider';
const PROVIDER_KIND  = 'supply-chain-quality';

const DEFAULT_MIN_SCORE = 5;
const DEFAULT_PLATFORM  = 'github.com';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface ScorecardConfig {
  minScore?: number;
  platform?: string;
  includeChecks?: string[];
}

interface CheckResult {
  check: string;
  score: number;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ──────────────────────────────────────────────────────────────
// Risk classification
// ──────────────────────────────────────────────────────────────

/**
 * Map an OpenSSF check score (0-10) to a Clef risk level.
 */
function scoreToRiskLevel(score: number): CheckResult['riskLevel'] {
  if (score >= 8) return 'low';
  if (score >= 5) return 'medium';
  if (score >= 2) return 'high';
  return 'critical';
}

// ──────────────────────────────────────────────────────────────
// Perform result → Clef check results
// ──────────────────────────────────────────────────────────────

/**
 * Transform the OpenSSF Scorecard API response into Clef CheckResult
 * arrays. Returns all checks and the subset that qualify as risks.
 */
function transformScorecardResponse(
  raw: unknown,
  minScore: number,
  includeChecks: string[] | undefined,
): { scores: CheckResult[]; risks: CheckResult[] } {
  if (!raw || typeof raw !== 'object') {
    return { scores: [], risks: [] };
  }

  const obj = raw as Record<string, unknown>;
  const rawChecks = Array.isArray(obj['checks']) ? obj['checks'] : [];

  const scores: CheckResult[] = [];

  for (const item of rawChecks) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;

    const check  = typeof c['name']   === 'string' ? c['name']   : String(c['name'] ?? '');
    const score  = typeof c['score']  === 'number' ? c['score']  : Number(c['score'] ?? 0);
    const reason = typeof c['reason'] === 'string' ? c['reason'] : String(c['reason'] ?? '');

    // Apply includeChecks filter if provided
    if (includeChecks && includeChecks.length > 0 && !includeChecks.includes(check)) {
      continue;
    }

    scores.push({ check, score, reason, riskLevel: scoreToRiskLevel(score) });
  }

  // Risks are checks whose score falls below the configured threshold
  const risks = scores.filter(c => c.score < minScore);

  return { scores, risks };
}

/**
 * Resolve a target string to a platform/repo path for the API.
 *
 * Supports two formats:
 *   - "github.com/org/repo"       → { platform: "github.com", repo: "org/repo" }
 *   - "express" (npm package)     → perform npm lookup (handled by runtime)
 *     In that case the runtime pre-resolves the repo URL before calling
 *     the Scorecard API, so we still pass the raw target and let the
 *     endpoint handle resolution.
 */
function resolveRepo(target: string, platform: string): string {
  // If the target already looks like a host/org/repo URL, strip the host if
  // it matches the configured platform and return the org/repo part.
  const withoutProtocol = target.replace(/^https?:\/\//, '');

  if (withoutProtocol.startsWith(platform + '/')) {
    return withoutProtocol.slice(platform.length + 1);
  }

  // Otherwise pass through as-is; the runtime endpoint resolves it.
  return withoutProtocol;
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
      kind: PROVIDER_KIND,
    }) as StorageProgram<Result>;
  },

  scan(input: Record<string, unknown>) {
    const target    = (input.target as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    // ── Input validation ──────────────────────────────────────

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target is required (repo URL or npm package name)',
      }) as StorageProgram<Result>;
    }

    // config is optional; if provided it must be a valid JSON object
    let config: ScorecardConfig = {};
    if (configRaw && configRaw.trim() !== '') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(configRaw);
      } catch {
        return complete(createProgram(), 'error', {
          message: 'config must be valid JSON',
        }) as StorageProgram<Result>;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return complete(createProgram(), 'error', {
          message: 'config must be a JSON object',
        }) as StorageProgram<Result>;
      }
      config = parsed as ScorecardConfig;
    }

    const minScore     = typeof config.minScore === 'number' ? config.minScore : DEFAULT_MIN_SCORE;
    const platform     = typeof config.platform === 'string' && config.platform.trim() !== ''
      ? config.platform
      : DEFAULT_PLATFORM;
    const includeChecks = Array.isArray(config.includeChecks) ? config.includeChecks : undefined;

    const repo = resolveRepo(target.trim(), platform);

    // ── Call OpenSSF Scorecard REST API via perform() ─────────
    //
    // Routes through: EffectHandler → ExternalCall
    // → HttpProvider → openssf-scorecard-api endpoint.
    // The perform result is the raw Scorecard API JSON body.
    //
    // Using perform('http', 'GET') keeps all network I/O outside
    // this module, enabling ConnectorCall tracking, RetryPolicy,
    // CircuitBreaker, and RateLimiter wiring automatically.

    let p = createProgram();
    p = perform(p, 'http', 'GET', {
      endpoint: 'openssf-scorecard-api',
      path: `/projects/${platform}/${repo}`,
    }, '_scorecardResult');

    // ── Map API response → scores + risks ────────────────────

    return branch(
      p,
      (b) => {
        const result = b['_scorecardResult'] as Record<string, unknown> | undefined;
        return result != null && typeof result === 'object' && !('error' in result);
      },
      (b) => {
        const result = b['_scorecardResult'] as Record<string, unknown>;
        const { scores, risks } = transformScorecardResponse(result, minScore, includeChecks);

        const scoresJson = JSON.stringify(scores);
        const risksJson  = JSON.stringify(risks);

        return complete(createProgram(), 'ok', {
          scores: scoresJson,
          risks: risksJson,
        }) as StorageProgram<Result>;
      },
      (b) => {
        const result = b['_scorecardResult'] as Record<string, unknown> | undefined;
        const message = result && typeof result['error'] === 'string'
          ? result['error']
          : 'OpenSSF Scorecard API returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const openSSFScorecardHandler = autoInterpret(_handler);

export default openSSFScorecardHandler;
