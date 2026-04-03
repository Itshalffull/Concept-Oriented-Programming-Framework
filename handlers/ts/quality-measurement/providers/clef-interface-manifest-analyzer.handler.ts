// @clef-handler style=functional concept=ClefInterfaceManifestAnalyzer
// ============================================================
// ClefInterfaceManifestAnalyzer Handler
//
// Clef-specific quality provider that analyzes interface.yaml manifests for:
//   - Projection completeness (all concept actions projected into at least one interface)
//   - Target compatibility (REST, GraphQL, gRPC, CLI, MCP each have their required fields)
//   - Endpoint naming conventions (REST paths use kebab-case, GraphQL uses camelCase)
//   - Version consistency across targets (all targets on same major version)
//   - Missing authentication declarations for state-mutating operations
//   - Orphaned projections (referencing actions that don't exist in concept specs)
//
// Delegates filesystem reads and YAML parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to an interface.yaml file or directory of interface.yaml files
//   config  — JSON string with optional rules:
//             {
//               requireAuth?: boolean,          // default: true for mutations
//               checkProjectionCoverage?: boolean, // default: true
//               specDir?: string               // path to concept specs for orphan checks
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, manifestCount, targetCount,
//               projectionCount, orphanCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-interface-parser-runtime"
//   command:  "analyze-interface-manifest"
//   args:     { target, config }
//   returns:  { manifests: ManifestAnalysis[] }
//   where ManifestAnalysis = {
//     path, name, targetCount, projectionCount, orphanCount,
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

const PROVIDER_NAME = 'ClefInterfaceManifestAnalyzer';
const PROVIDER_KIND = 'clef-interface-manifest';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  requireAuth?: boolean;
  checkProjectionCoverage?: boolean;
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

interface ManifestAnalysis {
  path: string;
  name: string;
  targetCount: number;
  projectionCount: number;
  orphanCount: number;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  manifestCount: number;
  targetCount: number;
  projectionCount: number;
  orphanCount: number;
  findingCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      manifestCount: 0,
      targetCount: 0,
      projectionCount: 0,
      orphanCount: 0,
      findingCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const manifests = Array.isArray(obj['manifests'])
    ? (obj['manifests'] as ManifestAnalysis[])
    : [];

  const fileSet = new Set<string>();
  let manifestCount = manifests.length;
  let targetCount = 0;
  let projectionCount = 0;
  let orphanCount = 0;
  const findings: Finding[] = [];

  for (const m of manifests) {
    if (m.path) fileSet.add(m.path);
    targetCount += m.targetCount ?? 0;
    projectionCount += m.projectionCount ?? 0;
    orphanCount += m.orphanCount ?? 0;
    if (Array.isArray(m.findings)) {
      findings.push(...m.findings);
    }
  }

  return {
    findings,
    fileCount: fileSet.size,
    manifestCount,
    targetCount,
    projectionCount,
    orphanCount,
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

    // ── Delegate to clef-interface-parser-runtime via perform()

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-interface-parser-runtime',
      command: 'analyze-interface-manifest',
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
        const {
          findings,
          fileCount,
          manifestCount,
          targetCount,
          projectionCount,
          orphanCount,
          findingCount,
        } = mapPerformResult(result);

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          manifestCount,
          targetCount,
          projectionCount,
          orphanCount,
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
            : 'clef-interface-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefInterfaceManifestAnalyzerHandler = autoInterpret(_handler);

export default clefInterfaceManifestAnalyzerHandler;
