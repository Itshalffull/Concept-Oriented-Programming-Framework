// @clef-handler style=functional concept=ClefSyncTopologyAnalyzer
// ============================================================
// ClefSyncTopologyAnalyzer Handler
//
// Clef-specific quality provider that builds a sync dispatch graph
// from .sync files and checks for:
//   - Cycles in the sync chain (A → B → C → A)
//   - Fan-out limits (syncs that trigger too many downstream actions)
//   - Dangling references (when/then clauses referencing unknown concepts)
//   - Missing purpose clauses on sync declarations
//   - Unbound variables in then-clauses
//   - Overly broad pattern matches (matching all variants)
//
// Delegates filesystem reads and sync parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a .sync file or directory of .sync files
//   config  — JSON string with optional rules:
//             {
//               maxFanOut?: number,          // default: 10
//               requirePurpose?: boolean,    // default: true
//               conceptManifestDir?: string  // path to concept specs for ref checks
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, syncCount, edgeCount,
//               cycleCount, danglingRefCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-sync-parser-runtime"
//   command:  "analyze-sync-topology"
//   args:     { target, config }
//   returns:  { syncs: SyncAnalysis[], graph: GraphEdge[], cycles: string[][] }
//   where SyncAnalysis = {
//     name, file, hasPurpose, whenConcepts, thenConcepts,
//     unboundVars, findings: Finding[]
//   }
//   GraphEdge = { from: string, to: string }
//   Finding = { path, rule, severity, message }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, perform, branch,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ClefSyncTopologyAnalyzer';
const PROVIDER_KIND = 'clef-sync-topology';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  maxFanOut?: number;
  requirePurpose?: boolean;
  conceptManifestDir?: string;
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

interface SyncAnalysis {
  name: string;
  file: string;
  hasPurpose: boolean;
  whenConcepts: string[];
  thenConcepts: string[];
  unboundVars: string[];
  findings: Finding[];
}

interface GraphEdge {
  from: string;
  to: string;
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  syncCount: number;
  edgeCount: number;
  cycleCount: number;
  danglingRefCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      syncCount: 0,
      edgeCount: 0,
      cycleCount: 0,
      danglingRefCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const syncs = Array.isArray(obj['syncs']) ? (obj['syncs'] as SyncAnalysis[]) : [];
  const graph = Array.isArray(obj['graph']) ? (obj['graph'] as GraphEdge[]) : [];
  const cycles = Array.isArray(obj['cycles']) ? (obj['cycles'] as string[][]) : [];

  const syncCount = syncs.length;
  const edgeCount = graph.length;
  const cycleCount = cycles.length;

  const fileSet = new Set<string>();
  let danglingRefCount = 0;
  const findings: Finding[] = [];

  for (const sync of syncs) {
    if (sync.file) fileSet.add(sync.file);
    if (Array.isArray(sync.findings)) {
      for (const f of sync.findings) {
        if (f.rule === 'dangling-reference') danglingRefCount++;
        findings.push(f);
      }
    }
  }

  // Add cycle findings
  for (const cycle of cycles) {
    findings.push({
      path: '',
      rule: 'sync-cycle',
      severity: 'error',
      message: `Sync cycle detected: ${cycle.join(' → ')}`,
    });
  }

  return {
    findings,
    fileCount: fileSet.size,
    syncCount,
    edgeCount,
    cycleCount,
    danglingRefCount,
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

    // ── Delegate to clef-sync-parser-runtime via perform() ────

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-sync-parser-runtime',
      command: 'analyze-sync-topology',
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
        const { findings, fileCount, syncCount, edgeCount, cycleCount, danglingRefCount } =
          mapPerformResult(result);
        const findingCount = findings.length;

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          syncCount,
          edgeCount,
          cycleCount,
          danglingRefCount,
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
            : 'clef-sync-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefSyncTopologyAnalyzerHandler = autoInterpret(_handler);

export default clefSyncTopologyAnalyzerHandler;
