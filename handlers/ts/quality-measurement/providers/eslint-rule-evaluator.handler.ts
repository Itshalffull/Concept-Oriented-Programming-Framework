// @clef-handler style=functional concept=EslintRuleEvaluatorProvider
// ============================================================
// EslintRuleEvaluatorProvider Handler
//
// Wraps ESLint as a Rule provider. Delegates actual ESLint
// execution to the ESLint runtime via perform() transport
// effects — never imports ESLint directly. Registers with
// PluginRegistry as a rule-evaluator provider under name
// "eslint".
//
// Inputs:
//   ruleId  — ESLint rule identifier (e.g. "no-unused-vars")
//   target  — file path to evaluate
//   config  — JSON string with ESLint config overrides
//             { rules?: Record<string,any>, parser?: string,
//               parserOptions?: Record<string,any>,
//               env?: Record<string,boolean> }
//
// Output (ok):
//   violations — JSON array of Clef Finding-format objects:
//     [ { ruleId, target, location, message, severity }, ... ]
//
// ESLint severity mapping:
//   ESLint 1 (warn)  → "minor"
//   ESLint 2 (error) → "major"
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, perform, branch,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'EslintRuleEvaluatorProvider';
const EVALUATOR_KIND = 'eslint';

// ──────────────────────────────────────────────────────────────
// Finding shape (subset of Clef Finding concept fields)
// ──────────────────────────────────────────────────────────────

interface EslintFinding {
  ruleId: string;
  target: string;
  location: string;  // "line:col"
  message: string;
  severity: 'minor' | 'major';
}

// ──────────────────────────────────────────────────────────────
// ESLint severity mapping
// ──────────────────────────────────────────────────────────────

/**
 * Map ESLint numeric severity (1=warn, 2=error) to Clef Finding
 * severity vocabulary. Unknown values default to "minor".
 */
function mapSeverity(eslintSeverity: number): 'minor' | 'major' {
  return eslintSeverity >= 2 ? 'major' : 'minor';
}

// ──────────────────────────────────────────────────────────────
// ESLint perform result → Clef Finding array
// ──────────────────────────────────────────────────────────────

/**
 * Transform the ESLint runtime perform result (an array of ESLint
 * LintMessage-shaped objects) into Clef Finding format.
 *
 * The ESLint runtime is expected to return an object matching:
 * {
 *   messages: Array<{
 *     ruleId: string | null,
 *     message: string,
 *     line: number,
 *     column: number,
 *     severity: number,
 *   }>
 * }
 */
function transformMessages(
  ruleId: string,
  target: string,
  raw: unknown,
): EslintFinding[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const messages = Array.isArray(obj['messages']) ? obj['messages'] : [];

  const findings: EslintFinding[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const m = msg as Record<string, unknown>;

    // Only include messages for the requested ruleId (ESLint may report
    // parse errors or config issues under a different ruleId).
    const msgRuleId = (m['ruleId'] as string | null) ?? ruleId;
    if (msgRuleId !== ruleId) continue;

    const line = typeof m['line'] === 'number' ? m['line'] : 0;
    const col = typeof m['column'] === 'number' ? m['column'] : 0;
    const message = typeof m['message'] === 'string' ? m['message'] : String(m['message'] ?? '');
    const severity = mapSeverity(typeof m['severity'] === 'number' ? m['severity'] : 1);

    findings.push({
      ruleId,
      target,
      location: `${line}:${col}`,
      message,
      severity,
    });
  }

  return findings;
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
    const ruleId = (input.ruleId as string) ?? '';
    const target = (input.target as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    // ── Input validation ──────────────────────────────────────

    if (!ruleId || ruleId.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'ruleId is required' }) as StorageProgram<Result>;
    }

    if (!target || target.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'target is required' }) as StorageProgram<Result>;
    }

    // config is optional; if provided it must be valid JSON
    let configOverrides: Record<string, unknown> = {};
    if (configRaw && configRaw.trim() !== '') {
      try {
        const parsed = JSON.parse(configRaw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          configOverrides = parsed as Record<string, unknown>;
        } else {
          const p = createProgram();
          return complete(p, 'error', { message: 'config must be a JSON object' }) as StorageProgram<Result>;
        }
      } catch {
        const p = createProgram();
        return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
      }
    }

    // ── Delegate to ESLint runtime via perform() ──────────────
    //
    // Routes through: EffectHandler → ExternalCall/LocalProcess
    // → EslintProvider → instance. The provider receives:
    //   { ruleId, target, config: configOverrides }
    // and returns:
    //   { messages: LintMessage[] }
    //
    // This keeps ESLint out of this module entirely — no import,
    // no direct spawn, full observability via ConnectorCall and
    // RetryPolicy sync wiring.

    let p = createProgram();
    p = perform(p, 'eslint', 'lint', {
      endpoint: 'eslint-runtime',
      ruleId,
      target,
      config: configOverrides,
    }, '_eslintResult');

    // ── Map perform result → Clef Finding format ──────────────

    return branch(
      p,
      (b) => {
        const result = b['_eslintResult'] as Record<string, unknown> | undefined;
        return result != null && typeof result === 'object' && !('error' in result);
      },
      (b) => {
        const result = b['_eslintResult'] as Record<string, unknown>;
        const findings = transformMessages(ruleId, target, result);
        const violations = JSON.stringify(findings);
        return complete(createProgram(), 'ok', { violations }) as StorageProgram<Result>;
      },
      (b) => {
        const result = b['_eslintResult'] as Record<string, unknown> | undefined;
        const message = result && typeof result['error'] === 'string'
          ? result['error']
          : 'ESLint runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const eslintRuleEvaluatorHandler = autoInterpret(_handler);

export default eslintRuleEvaluatorHandler;
