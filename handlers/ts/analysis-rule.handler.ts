// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// AnalysisRule Handler
//
// Declarative analysis rule for deriving facts from program
// entities — custom queries, linting, and architectural
// constraint validation. Supports multiple engine backends
// (datalog, graph traversal, pattern match).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `analysis-rule-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const VALID_ENGINES = ['datalog', 'graph-traversal', 'pattern-match'];
const VALID_SEVERITIES = ['error', 'warning', 'info'];

/**
 * Simple pattern-matching evaluation engine. Interprets rule source
 * as a JSON-encoded pattern descriptor with { match, message } entries.
 * Each entry's `match` field is treated as a substring to search for
 * in the stored program facts.
 */
function evaluateRuleSource(
  engine: string,
  source: string,
  _facts: Record<string, unknown>[],
): { message: string; symbol: string; file: string; location: string }[] {
  const findings: { message: string; symbol: string; file: string; location: string }[] = [];

  try {
    const patterns = JSON.parse(source) as {
      match: string;
      message: string;
    }[];

    for (const fact of _facts) {
      const factStr = JSON.stringify(fact);
      for (const pattern of patterns) {
        if (engine === 'pattern-match') {
          if (factStr.includes(pattern.match)) {
            findings.push({
              message: pattern.message,
              symbol: (fact.symbol as string) ?? '',
              file: (fact.file as string) ?? '',
              location: (fact.location as string) ?? '',
            });
          }
        } else if (engine === 'graph-traversal') {
          if ((fact.kind as string) === pattern.match || factStr.includes(pattern.match)) {
            findings.push({
              message: pattern.message,
              symbol: (fact.symbol as string) ?? '',
              file: (fact.file as string) ?? '',
              location: (fact.location as string) ?? '',
            });
          }
        } else if (engine === 'datalog') {
          if ((fact.relation as string) === pattern.match || factStr.includes(pattern.match)) {
            findings.push({
              message: pattern.message,
              symbol: (fact.symbol as string) ?? '',
              file: (fact.file as string) ?? '',
              location: (fact.location as string) ?? '',
            });
          }
        }
      }
    }
  } catch {
    // Source is not valid JSON patterns; return empty findings
  }

  return findings;
}

const _analysisRuleHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const engine = input.engine as string;
    const source = input.source as string;
    const severity = input.severity as string;
    const category = input.category as string;

    // Validate engine
    if (!VALID_ENGINES.includes(engine)) {
      const p = createProgram();
      return complete(p, 'invalidSyntax', {
        message: `Unknown engine "${engine}". Must be one of: ${VALID_ENGINES.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // Validate source syntax: for all engines, source must be valid JSON
    try {
      JSON.parse(source);
    } catch {
      const p = createProgram();
      return complete(p, 'invalidSyntax', {
        message: `Rule source is not valid JSON for engine "${engine}"`,
      }) as StorageProgram<Result>;
    }

    const id = nextId();

    let p = createProgram();
    p = put(p, 'analysis-rule', id, {
      id,
      name,
      engine,
      source,
      severity: VALID_SEVERITIES.includes(severity) ? severity : 'info',
      category,
    });

    return complete(p, 'ok', { rule: id }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const rule = input.rule as string;

    let p = createProgram();
    p = get(p, 'analysis-rule', rule, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = find(b, 'analysis-fact', {}, 'facts');
        return completeFrom(b2, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const facts = bindings.facts as Record<string, unknown>[];
          const findings = evaluateRuleSource(
            record.engine as string,
            record.source as string,
            facts,
          );
          if (findings.length === 0) {
            return { variant: 'noFindings' };
          }
          return { findings: JSON.stringify(findings) };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'evaluationError', { message: `Rule "${rule}" not found` }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  evaluateAll(input: Record<string, unknown>) {
    const category = input.category as string;

    const criteria: Record<string, unknown> = {};
    if (category !== undefined && category !== '') {
      criteria.category = category;
    }

    let p = createProgram();
    p = find(p, 'analysis-rule', Object.keys(criteria).length > 0 ? criteria : {}, 'rules');
    p = find(p, 'analysis-fact', {}, 'facts');

    return completeFrom(p, 'ok', (bindings) => {
      const rules = bindings.rules as Record<string, unknown>[];
      const facts = bindings.facts as Record<string, unknown>[];

      const results: { rule: string; findingCount: number; findings: unknown[] }[] = [];
      for (const rule of rules) {
        const engine = rule.engine as string;
        const source = rule.source as string;
        const findings = evaluateRuleSource(engine, source, facts);
        results.push({
          rule: rule.id as string,
          findingCount: findings.length,
          findings,
        });
      }

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const rule = input.rule as string;

    let p = createProgram();
    p = get(p, 'analysis-rule', rule, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          rule: record.id as string,
          name: record.name as string,
          engine: record.engine as string,
          severity: record.severity as string,
          category: record.category as string,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },
};

export const analysisRuleHandler = autoInterpret(_analysisRuleHandler);

/** Reset the ID counter. Useful for testing. */
export function resetAnalysisRuleCounter(): void {
  idCounter = 0;
}
