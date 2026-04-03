// @clef-handler style=functional concept=ImportGraphAnalyzerProvider
// ============================================================
// ImportGraphAnalyzerProvider Handler
//
// ArchitecturalFitness provider that builds a directed import
// dependency graph for a TypeScript/JavaScript project and detects:
//   - Circular dependencies via Tarjan's SCC algorithm
//   - Boundary violations based on caller-supplied layer rules
//   - Forbidden import patterns (glob-style from/to matching)
//
// Delegates the filesystem walk and compiler-API parse step to the
// runtime via perform('local-process', 'run', ...) so the handler
// remains pure and fully observable (ConnectorCall, RetryPolicy,
// CircuitBreaker wiring applies automatically).
//
// Inputs (analyze):
//   target  — absolute file path or directory root to analyse
//   config  — JSON string with boundary rules:
//             {
//               layers?: Array<{ name: string, allowedDependencies: string[] }>,
//               forbiddenPatterns?: Array<{ from: string, to: string, reason: string }>,
//               extensions?: string[]   // default: [".ts",".tsx",".js",".jsx"]
//             }
//
// Output (analyze ok):
//   violations — JSON-stringified array of Finding-format objects
//   metrics    — JSON-stringified summary { fileCount, edgeCount,
//                  cycleCount, violationCount }
//
// Perform contract (local-process):
//   endpoint: "import-graph-runtime"
//   command:  "analyze"
//   args:     { target, config }
//   returns:  { graph: EdgeList, cycles: SCC[], violations: Finding[] }
//   where EdgeList = Array<{ from: string, to: string }>
//         SCC      = string[]   (files in the strongly-connected component)
//         Finding  = { from, to, violationType, message }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, completeFrom, perform, branch, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ImportGraphAnalyzerProvider';
const PROVIDER_KIND  = 'architectural-fitness';

// ──────────────────────────────────────────────────────────────
// Finding shape (matches ArchitecturalFitness violation format)
// ──────────────────────────────────────────────────────────────

interface Finding {
  from: string;
  to: string;
  violationType: 'circular' | 'boundary' | 'forbidden';
  message: string;
}

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  layers?: Array<{ name: string; allowedDependencies: string[] }>;
  forbiddenPatterns?: Array<{ from: string; to: string; reason: string }>;
  extensions?: string[];
}

// ──────────────────────────────────────────────────────────────
// Result mapping helpers
// ──────────────────────────────────────────────────────────────

/**
 * Transform the perform result from the import-graph-runtime into
 * Clef Finding format and a metrics summary.
 */
function mapPerformResult(raw: unknown, target: string): {
  violations: Finding[];
  fileCount: number;
  edgeCount: number;
  cycleCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return { violations: [], fileCount: 0, edgeCount: 0, cycleCount: 0 };
  }

  const obj = raw as Record<string, unknown>;

  // Edge list → count
  const graph = Array.isArray(obj['graph']) ? obj['graph'] : [];
  const edgeCount = graph.length;

  // Unique files touched
  const fileSet = new Set<string>();
  for (const edge of graph) {
    const e = edge as Record<string, unknown>;
    if (e['from']) fileSet.add(e['from'] as string);
    if (e['to'])   fileSet.add(e['to'] as string);
  }
  const fileCount = fileSet.size;

  // Cycles (SCCs with more than one file)
  const cycles = Array.isArray(obj['cycles']) ? obj['cycles'] : [];
  const cycleCount = cycles.length;

  // Violations from runtime
  const rawViolations = Array.isArray(obj['violations']) ? obj['violations'] : [];
  const findings: Finding[] = [];

  // Map runtime-reported violations
  for (const v of rawViolations) {
    const viol = v as Record<string, unknown>;
    findings.push({
      from: typeof viol['from'] === 'string' ? viol['from'] : target,
      to: typeof viol['to'] === 'string' ? viol['to'] : '',
      violationType: (viol['violationType'] as Finding['violationType']) ?? 'boundary',
      message: typeof viol['message'] === 'string' ? viol['message'] : 'Boundary violation',
    });
  }

  // Add circular dependency findings from SCC cycles
  for (const cycle of cycles) {
    const files = Array.isArray(cycle) ? (cycle as string[]) : [];
    if (files.length < 2) continue;
    findings.push({
      from: files[0],
      to: files[files.length - 1],
      violationType: 'circular',
      message: `Circular dependency cycle of length ${files.length}: ${files.join(' → ')}`,
    });
  }

  return { violations: findings, fileCount, edgeCount, cycleCount };
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
    const target    = (input.target as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    // ── Input validation ──────────────────────────────────────

    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'target is required',
      }) as StorageProgram<Result>;
    }

    // config is optional; if provided it must be valid JSON object
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

    // ── Delegate to import-graph-runtime via perform() ────────
    //
    // Routes through: EffectHandler → LocalProcess
    // → ImportGraphProvider → instance. The provider receives:
    //   { target, config }
    // and returns:
    //   { graph: EdgeList, cycles: SCC[], violations: Finding[] }
    //
    // This keeps all filesystem and compiler-API access out of
    // this module — no ts-morph, tree-sitter, or fs imports —
    // while preserving full ConnectorCall / RetryPolicy coverage.

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'import-graph-runtime',
      command: 'analyze',
      args: { target, config },
    }, '_analyzeResult');

    // ── Map perform result → violations + metrics ─────────────

    return branch(
      p,
      (b) => {
        const result = b['_analyzeResult'] as Record<string, unknown> | undefined;
        return result != null && typeof result === 'object' && !('error' in result);
      },
      (b) => {
        const result = b['_analyzeResult'] as Record<string, unknown>;
        const { violations, fileCount, edgeCount, cycleCount } = mapPerformResult(result, target);
        const violationCount = violations.length;

        const violationsJson = JSON.stringify(violations);
        const metricsJson = JSON.stringify({ fileCount, edgeCount, cycleCount, violationCount });

        return complete(createProgram(), 'ok', {
          violations: violationsJson,
          metrics: metricsJson,
        }) as StorageProgram<Result>;
      },
      (b) => {
        const result = b['_analyzeResult'] as Record<string, unknown> | undefined;
        const message = result && typeof result['error'] === 'string'
          ? result['error']
          : 'import-graph-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const importGraphAnalyzerHandler = autoInterpret(_handler);

export default importGraphAnalyzerHandler;
