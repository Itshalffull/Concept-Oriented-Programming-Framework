// @clef-handler style=functional concept=ClefThemeAnalyzer
// ============================================================
// ClefThemeAnalyzer Handler
//
// Clef-specific quality provider that analyzes .theme files for:
//   - Token completeness (palette, typography, spacing, motion, elevation, radius)
//   - WCAG contrast compliance for color pairs (AA level by default)
//   - Inheritance chain validity (extends target exists and is not circular)
//   - Reduced-motion declaration for motion tokens
//   - oklch color format compliance
//   - Typography scale consistency (modular ratio applied correctly)
//
// Delegates filesystem reads and theme parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a .theme file or directory of .theme files
//   config  — JSON string with optional rules:
//             {
//               wcagLevel?: "A" | "AA" | "AAA",  // default: "AA"
//               requireReducedMotion?: boolean,   // default: true
//               requireAllSections?: boolean      // default: false
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, themeCount, tokenCount,
//               colorPairCount, contrastPassCount, contrastFailCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-theme-parser-runtime"
//   command:  "analyze-theme"
//   args:     { target, config }
//   returns:  { themes: ThemeAnalysis[] }
//   where ThemeAnalysis = {
//     path, name, extendsChain, tokenCount, colorPairs,
//     hasReducedMotion, findings: Finding[]
//   }
//   ColorPair = { foreground: string, background: string, ratio: number, passes: boolean }
//   Finding = { path, rule, severity, message }
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, perform, branch,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ClefThemeAnalyzer';
const PROVIDER_KIND = 'clef-theme';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  wcagLevel?: 'A' | 'AA' | 'AAA';
  requireReducedMotion?: boolean;
  requireAllSections?: boolean;
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

interface ColorPair {
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
}

interface ThemeAnalysis {
  path: string;
  name: string;
  extendsChain: string[];
  tokenCount: number;
  colorPairs: ColorPair[];
  hasReducedMotion: boolean;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  themeCount: number;
  tokenCount: number;
  colorPairCount: number;
  contrastPassCount: number;
  contrastFailCount: number;
  findingCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      themeCount: 0,
      tokenCount: 0,
      colorPairCount: 0,
      contrastPassCount: 0,
      contrastFailCount: 0,
      findingCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const themes = Array.isArray(obj['themes']) ? (obj['themes'] as ThemeAnalysis[]) : [];

  const fileSet = new Set<string>();
  let themeCount = themes.length;
  let tokenCount = 0;
  let colorPairCount = 0;
  let contrastPassCount = 0;
  let contrastFailCount = 0;
  const findings: Finding[] = [];

  for (const t of themes) {
    if (t.path) fileSet.add(t.path);
    tokenCount += t.tokenCount ?? 0;
    const pairs = Array.isArray(t.colorPairs) ? t.colorPairs : [];
    colorPairCount += pairs.length;
    for (const pair of pairs) {
      if (pair.passes) contrastPassCount++;
      else contrastFailCount++;
    }
    if (Array.isArray(t.findings)) {
      findings.push(...t.findings);
    }
  }

  return {
    findings,
    fileCount: fileSet.size,
    themeCount,
    tokenCount,
    colorPairCount,
    contrastPassCount,
    contrastFailCount,
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

    // ── Delegate to clef-theme-parser-runtime via perform() ───

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-theme-parser-runtime',
      command: 'analyze-theme',
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
          themeCount,
          tokenCount,
          colorPairCount,
          contrastPassCount,
          contrastFailCount,
          findingCount,
        } = mapPerformResult(result);

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          themeCount,
          tokenCount,
          colorPairCount,
          contrastPassCount,
          contrastFailCount,
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
            : 'clef-theme-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefThemeAnalyzerHandler = autoInterpret(_handler);

export default clefThemeAnalyzerHandler;
