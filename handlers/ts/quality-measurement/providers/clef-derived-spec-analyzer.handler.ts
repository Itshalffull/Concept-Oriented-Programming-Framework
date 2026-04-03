// @clef-handler style=functional concept=ClefDerivedSpecAnalyzer
// ============================================================
// ClefDerivedSpecAnalyzer Handler
//
// Clef-specific quality provider that analyzes .derived files for:
//   - Composition DAG validity (no cycles in derived-of-derived chains)
//   - Surface action coverage (entry patterns reference real concept actions)
//   - Sync claims consistency (claimed syncs exist and belong to composed concepts)
//   - Type parameter unification (same letter used consistently across composes)
//   - Purpose and operational principle completeness
//   - Query route validity (query → target action exists)
//
// Delegates filesystem reads and derived parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a .derived file or directory of .derived files
//   config  — JSON string with optional rules:
//             {
//               requirePrinciple?: boolean,   // default: true
//               checkSyncClaims?: boolean,     // default: true
//               specDir?: string              // path to concept specs for ref checks
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, derivedCount,
//               surfaceActionCount, queryCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-derived-parser-runtime"
//   command:  "analyze-derived-spec"
//   args:     { target, config }
//   returns:  { derived: DerivedAnalysis[] }
//   where DerivedAnalysis = {
//     path, name, composeCount, surfaceActionCount, queryCount,
//     claimedSyncCount, hasPrinciple, findings: Finding[]
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

const PROVIDER_NAME = 'ClefDerivedSpecAnalyzer';
const PROVIDER_KIND = 'clef-derived-spec';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  requirePrinciple?: boolean;
  checkSyncClaims?: boolean;
  specDir?: string;
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

interface DerivedAnalysis {
  path: string;
  name: string;
  composeCount: number;
  surfaceActionCount: number;
  queryCount: number;
  claimedSyncCount: number;
  hasPrinciple: boolean;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  derivedCount: number;
  surfaceActionCount: number;
  queryCount: number;
  findingCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      derivedCount: 0,
      surfaceActionCount: 0,
      queryCount: 0,
      findingCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const derived = Array.isArray(obj['derived']) ? (obj['derived'] as DerivedAnalysis[]) : [];

  const fileSet = new Set<string>();
  let derivedCount = derived.length;
  let surfaceActionCount = 0;
  let queryCount = 0;
  const findings: Finding[] = [];

  for (const d of derived) {
    if (d.path) fileSet.add(d.path);
    surfaceActionCount += d.surfaceActionCount ?? 0;
    queryCount += d.queryCount ?? 0;
    if (Array.isArray(d.findings)) {
      findings.push(...d.findings);
    }
  }

  return {
    findings,
    fileCount: fileSet.size,
    derivedCount,
    surfaceActionCount,
    queryCount,
    findingCount: findings.length,
  };
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

    // ── Delegate to clef-derived-parser-runtime via perform() ─

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-derived-parser-runtime',
      command: 'analyze-derived-spec',
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
        const { findings, fileCount, derivedCount, surfaceActionCount, queryCount, findingCount } =
          mapPerformResult(result);

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          derivedCount,
          surfaceActionCount,
          queryCount,
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
            : 'clef-derived-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefDerivedSpecAnalyzerHandler = autoInterpret(_handler);

export default clefDerivedSpecAnalyzerHandler;
