// @clef-handler style=functional concept=ClefWidgetSpecAnalyzer
// ============================================================
// ClefWidgetSpecAnalyzer Handler
//
// Clef-specific quality provider that analyzes .widget files for:
//   - Interactor classification completeness (role, keyboard, focus declared)
//   - Accessibility coverage (ARIA role, keyboard navigation, focus management)
//   - Slot/anatomy contracts (all parts declared in anatomy block)
//   - State machine validity (transitions reference declared states)
//   - Affordance coverage (at least one affordance per interactive part)
//   - Connect block completeness (data attributes map to concept actions)
//
// Delegates filesystem reads and widget parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a .widget file or directory of .widget files
//   config  — JSON string with optional rules:
//             {
//               requireA11y?: boolean,       // default: true
//               requireAffordance?: boolean, // default: true
//               wcagLevel?: "A" | "AA" | "AAA" // default: "AA"
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, widgetCount,
//               partCount, stateCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-widget-parser-runtime"
//   command:  "analyze-widget-spec"
//   args:     { target, config }
//   returns:  { widgets: WidgetAnalysis[] }
//   where WidgetAnalysis = {
//     path, name, partCount, stateCount, hasA11y, hasAffordance,
//     hasConnect, findings: Finding[]
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

const PROVIDER_NAME = 'ClefWidgetSpecAnalyzer';
const PROVIDER_KIND = 'clef-widget-spec';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  requireA11y?: boolean;
  requireAffordance?: boolean;
  wcagLevel?: 'A' | 'AA' | 'AAA';
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

interface WidgetAnalysis {
  path: string;
  name: string;
  partCount: number;
  stateCount: number;
  hasA11y: boolean;
  hasAffordance: boolean;
  hasConnect: boolean;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  widgetCount: number;
  partCount: number;
  stateCount: number;
  findingCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      widgetCount: 0,
      partCount: 0,
      stateCount: 0,
      findingCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const widgets = Array.isArray(obj['widgets']) ? (obj['widgets'] as WidgetAnalysis[]) : [];

  const fileSet = new Set<string>();
  let widgetCount = widgets.length;
  let partCount = 0;
  let stateCount = 0;
  const findings: Finding[] = [];

  for (const w of widgets) {
    if (w.path) fileSet.add(w.path);
    partCount += w.partCount ?? 0;
    stateCount += w.stateCount ?? 0;
    if (Array.isArray(w.findings)) {
      findings.push(...w.findings);
    }
  }

  return {
    findings,
    fileCount: fileSet.size,
    widgetCount,
    partCount,
    stateCount,
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

    // ── Delegate to clef-widget-parser-runtime via perform() ──

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-widget-parser-runtime',
      command: 'analyze-widget-spec',
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
        const { findings, fileCount, widgetCount, partCount, stateCount, findingCount } =
          mapPerformResult(result);

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          widgetCount,
          partCount,
          stateCount,
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
            : 'clef-widget-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefWidgetSpecAnalyzerHandler = autoInterpret(_handler);

export default clefWidgetSpecAnalyzerHandler;
