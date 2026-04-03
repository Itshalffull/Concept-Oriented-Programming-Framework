// @clef-handler style=functional concept=ClefSuiteManifestAnalyzer
// ============================================================
// ClefSuiteManifestAnalyzer Handler
//
// Clef-specific quality provider that analyzes suite.yaml files for:
//   - Uses declarations completeness (all referenced concepts declared)
//   - Type parameter mappings consistency (aligned across composed concepts)
//   - Version compatibility (semver ranges don't conflict)
//   - Required/recommended tier declarations for all syncs
//   - Dependency cycle detection across suites
//   - Missing suite metadata (name, description, version)
//
// Delegates filesystem reads and YAML parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a suite.yaml file or directory containing suite.yaml files
//   config  — JSON string with optional rules:
//             {
//               requireDescription?: boolean,  // default: true
//               checkVersionRanges?: boolean,  // default: true
//               suiteRegistryDir?: string      // path to known suites for dep checks
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, suiteCount, conceptCount,
//               syncCount, depCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-suite-parser-runtime"
//   command:  "analyze-suite-manifest"
//   args:     { target, config }
//   returns:  { suites: SuiteAnalysis[] }
//   where SuiteAnalysis = {
//     path, name, version, conceptCount, syncCount, depCount,
//     hasDescription, findings: Finding[]
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

const PROVIDER_NAME = 'ClefSuiteManifestAnalyzer';
const PROVIDER_KIND = 'clef-suite-manifest';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  requireDescription?: boolean;
  checkVersionRanges?: boolean;
  suiteRegistryDir?: string;
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

interface SuiteAnalysis {
  path: string;
  name: string;
  version: string;
  conceptCount: number;
  syncCount: number;
  depCount: number;
  hasDescription: boolean;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  suiteCount: number;
  conceptCount: number;
  syncCount: number;
  depCount: number;
  findingCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      suiteCount: 0,
      conceptCount: 0,
      syncCount: 0,
      depCount: 0,
      findingCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const suites = Array.isArray(obj['suites']) ? (obj['suites'] as SuiteAnalysis[]) : [];

  const fileSet = new Set<string>();
  let suiteCount = suites.length;
  let conceptCount = 0;
  let syncCount = 0;
  let depCount = 0;
  const findings: Finding[] = [];

  for (const s of suites) {
    if (s.path) fileSet.add(s.path);
    conceptCount += s.conceptCount ?? 0;
    syncCount += s.syncCount ?? 0;
    depCount += s.depCount ?? 0;
    if (Array.isArray(s.findings)) {
      findings.push(...s.findings);
    }
  }

  return {
    findings,
    fileCount: fileSet.size,
    suiteCount,
    conceptCount,
    syncCount,
    depCount,
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

    // ── Delegate to clef-suite-parser-runtime via perform() ───

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-suite-parser-runtime',
      command: 'analyze-suite-manifest',
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
        const { findings, fileCount, suiteCount, conceptCount, syncCount, depCount, findingCount } =
          mapPerformResult(result);

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          suiteCount,
          conceptCount,
          syncCount,
          depCount,
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
            : 'clef-suite-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefSuiteManifestAnalyzerHandler = autoInterpret(_handler);

export default clefSuiteManifestAnalyzerHandler;
