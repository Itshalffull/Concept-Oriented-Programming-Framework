// @clef-handler style=functional concept=ClefConceptSpecAnalyzer
// ============================================================
// ClefConceptSpecAnalyzer Handler
//
// Clef-specific quality provider that analyzes .concept files for:
//   - Naming conventions (PascalCase concept names, verb-first actions)
//   - Concept independence (no cross-concept references in state/actions)
//   - Spec completeness (purpose, state, actions, invariants present)
//   - Invariant coverage (every action has at least one test scenario)
//   - Fixture coverage (ok fixtures and error fixtures per action)
//   - Variant description quality (non-terse, non-echo descriptions)
//
// Delegates filesystem reads and spec parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a .concept file or directory of .concept files
//   config  — JSON string with optional rules:
//             {
//               requireInvariants?: boolean,    // default: true
//               requireFixtures?: boolean,       // default: true
//               maxActionCount?: number,         // warn if exceeded
//               namingStrict?: boolean           // default: true
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, actionCount,
//               invariantCount, fixtureCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-spec-parser-runtime"
//   command:  "analyze-concept-spec"
//   args:     { target, config }
//   returns:  { files: FileAnalysis[] }
//   where FileAnalysis = {
//     path: string,
//     conceptName: string,
//     actionCount: number,
//     invariantCount: number,
//     fixtureCount: number,
//     findings: Finding[]
//   }
//   Finding = { path, rule, severity, message }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, perform, branch,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ClefConceptSpecAnalyzer';
const PROVIDER_KIND = 'clef-concept-spec';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  requireInvariants?: boolean;
  requireFixtures?: boolean;
  maxActionCount?: number;
  namingStrict?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Result mapping helpers
// ──────────────────────────────────────────────────────────────

interface Finding {
  path: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface FileAnalysis {
  path: string;
  conceptName: string;
  actionCount: number;
  invariantCount: number;
  fixtureCount: number;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  actionCount: number;
  invariantCount: number;
  fixtureCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return { findings: [], fileCount: 0, actionCount: 0, invariantCount: 0, fixtureCount: 0 };
  }

  const obj = raw as Record<string, unknown>;
  const files = Array.isArray(obj['files']) ? (obj['files'] as FileAnalysis[]) : [];

  let fileCount = files.length;
  let actionCount = 0;
  let invariantCount = 0;
  let fixtureCount = 0;
  const findings: Finding[] = [];

  for (const file of files) {
    actionCount += file.actionCount ?? 0;
    invariantCount += file.invariantCount ?? 0;
    fixtureCount += file.fixtureCount ?? 0;
    if (Array.isArray(file.findings)) {
      findings.push(...file.findings);
    }
  }

  return { findings, fileCount, actionCount, invariantCount, fixtureCount };
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

  analyze(input: Record<string, unknown>) {
    const target = (input.target as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    // ── Input validation ──────────────────────────────────────

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target is required',
      }) as StorageProgram<Result>;
    }

    let config: AnalyzerConfig = {};
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
      config = parsed as AnalyzerConfig;
    }

    // ── Delegate to clef-spec-parser-runtime via perform() ────

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-spec-parser-runtime',
      command: 'analyze-concept-spec',
      args: { target, config },
    }, '_analyzeResult');

    // ── Map perform result → findings + metrics ───────────────

    return branch(
      p,
      (b) => {
        const result = b['_analyzeResult'] as Record<string, unknown> | undefined;
        return result != null && typeof result === 'object' && !('error' in result);
      },
      (b) => {
        const result = b['_analyzeResult'] as Record<string, unknown>;
        const { findings, fileCount, actionCount, invariantCount, fixtureCount } =
          mapPerformResult(result);
        const findingCount = findings.length;

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          actionCount,
          invariantCount,
          fixtureCount,
          findingCount,
        });

        return complete(createProgram(), 'ok', {
          findings: findingsJson,
          metrics: metricsJson,
        }) as StorageProgram<Result>;
      },
      (b) => {
        const result = b['_analyzeResult'] as Record<string, unknown> | undefined;
        const message =
          result && typeof result['error'] === 'string'
            ? result['error']
            : 'clef-spec-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefConceptSpecAnalyzerHandler = autoInterpret(_handler);

export default clefConceptSpecAnalyzerHandler;
