// @clef-handler style=functional concept=ClefSchemaAnalyzer
// ============================================================
// ClefSchemaAnalyzer Handler
//
// Clef-specific quality provider that analyzes schema specs for:
//   - Field type validity (all types are known Clef scalar or composite types)
//   - Includes chain integrity (no circular includes, no missing includes)
//   - Thing/mixin pattern compliance (mixins don't declare primary keys,
//     things must have at least one identifying field)
//   - Required field coverage (required fields have non-null defaults or docs)
//   - Enum value completeness (at least one member per enum)
//   - Cross-concept field type consistency (same field name = same type)
//
// Delegates filesystem reads and schema parsing to the runtime via
// perform('local-process', 'run', ...) to keep the handler pure.
//
// Inputs (analyze):
//   target  — absolute path to a schema file or directory of schema files
//   config  — JSON string with optional rules:
//             {
//               requireDocstrings?: boolean,   // default: false
//               strictTypeNames?: boolean,      // default: true
//               schemaDir?: string             // base dir for includes resolution
//             }
//
// Output (analyze ok):
//   findings — JSON-stringified array of Finding objects
//   metrics  — JSON-stringified summary { fileCount, schemaCount, fieldCount,
//               includeCount, findingCount }
//
// Perform contract (local-process):
//   endpoint: "clef-schema-parser-runtime"
//   command:  "analyze-schema"
//   args:     { target, config }
//   returns:  { schemas: SchemaAnalysis[] }
//   where SchemaAnalysis = {
//     path, name, kind ("thing" | "mixin"), fieldCount, includeCount,
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

const PROVIDER_NAME = 'ClefSchemaAnalyzer';
const PROVIDER_KIND = 'clef-schema';

// ──────────────────────────────────────────────────────────────
// Config type
// ──────────────────────────────────────────────────────────────

interface AnalyzerConfig {
  requireDocstrings?: boolean;
  strictTypeNames?: boolean;
  schemaDir?: string;
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

interface SchemaAnalysis {
  path: string;
  name: string;
  kind: 'thing' | 'mixin' | string;
  fieldCount: number;
  includeCount: number;
  findings: Finding[];
}

function mapPerformResult(raw: unknown): {
  findings: Finding[];
  fileCount: number;
  schemaCount: number;
  fieldCount: number;
  includeCount: number;
  findingCount: number;
} {
  if (!raw || typeof raw !== 'object') {
    return {
      findings: [],
      fileCount: 0,
      schemaCount: 0,
      fieldCount: 0,
      includeCount: 0,
      findingCount: 0,
    };
  }

  const obj = raw as Record<string, unknown>;
  const schemas = Array.isArray(obj['schemas']) ? (obj['schemas'] as SchemaAnalysis[]) : [];

  const fileSet = new Set<string>();
  let schemaCount = schemas.length;
  let fieldCount = 0;
  let includeCount = 0;
  const findings: Finding[] = [];

  for (const s of schemas) {
    if (s.path) fileSet.add(s.path);
    fieldCount += s.fieldCount ?? 0;
    includeCount += s.includeCount ?? 0;
    if (Array.isArray(s.findings)) {
      findings.push(...s.findings);
    }
  }

  return {
    findings,
    fileCount: fileSet.size,
    schemaCount,
    fieldCount,
    includeCount,
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

    // ── Delegate to clef-schema-parser-runtime via perform() ──

    let p = createProgram();
    p = perform(p, 'local-process', 'run', {
      endpoint: 'clef-schema-parser-runtime',
      command: 'analyze-schema',
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
        const { findings, fileCount, schemaCount, fieldCount, includeCount, findingCount } =
          mapPerformResult(result);

        const findingsJson = JSON.stringify(findings);
        const metricsJson = JSON.stringify({
          fileCount,
          schemaCount,
          fieldCount,
          includeCount,
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
            : 'clef-schema-parser-runtime returned an error';
        return complete(createProgram(), 'error', { message }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const clefSchemaAnalyzerHandler = autoInterpret(_handler);

export default clefSchemaAnalyzerHandler;
