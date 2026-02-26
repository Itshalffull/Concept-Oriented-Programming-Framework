// ============================================================
// AnalysisRule Handler
//
// Declarative analysis rule for deriving facts from program
// entities — custom queries, linting, and architectural
// constraint validation. Supports multiple engine backends
// (datalog, graph traversal, pattern match).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `analysis-rule-${++idCounter}`;
}

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
          // AST pattern matching: substring match against serialized fact
          if (factStr.includes(pattern.match)) {
            findings.push({
              message: pattern.message,
              symbol: (fact.symbol as string) ?? '',
              file: (fact.file as string) ?? '',
              location: (fact.location as string) ?? '',
            });
          }
        } else if (engine === 'graph-traversal') {
          // Graph reachability: treat match as a node kind to find
          if ((fact.kind as string) === pattern.match || factStr.includes(pattern.match)) {
            findings.push({
              message: pattern.message,
              symbol: (fact.symbol as string) ?? '',
              file: (fact.file as string) ?? '',
              location: (fact.location as string) ?? '',
            });
          }
        } else if (engine === 'datalog') {
          // Datalog fact-based: treat match as a relation/predicate name
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

export const analysisRuleHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const engine = input.engine as string;
    const source = input.source as string;
    const severity = input.severity as string;
    const category = input.category as string;

    // Validate engine
    if (!VALID_ENGINES.includes(engine)) {
      return {
        variant: 'invalidSyntax',
        message: `Unknown engine "${engine}". Must be one of: ${VALID_ENGINES.join(', ')}`,
      };
    }

    // Validate source syntax: for all engines, source must be valid JSON
    try {
      JSON.parse(source);
    } catch {
      return {
        variant: 'invalidSyntax',
        message: `Rule source is not valid JSON for engine "${engine}"`,
      };
    }

    const id = nextId();
    await storage.put('analysis-rule', id, {
      id,
      name,
      engine,
      source,
      severity: VALID_SEVERITIES.includes(severity) ? severity : 'info',
      category,
    });

    return { variant: 'ok', rule: id };
  },

  async evaluate(input: Record<string, unknown>, storage: ConceptStorage) {
    const rule = input.rule as string;

    const record = await storage.get('analysis-rule', rule);
    if (!record) {
      return { variant: 'evaluationError', message: `Rule "${rule}" not found` };
    }

    const engine = record.engine as string;
    const source = record.source as string;

    // Retrieve program facts from storage (stored by analysis engine providers)
    const facts = await storage.find('analysis-fact', {});

    const findings = evaluateRuleSource(engine, source, facts);

    if (findings.length === 0) {
      return { variant: 'noFindings' };
    }

    return { variant: 'ok', findings: JSON.stringify(findings) };
  },

  async evaluateAll(input: Record<string, unknown>, storage: ConceptStorage) {
    const category = input.category as string;

    // Retrieve all rules, optionally filtered by category
    const criteria: Record<string, unknown> = {};
    if (category !== undefined && category !== '') {
      criteria.category = category;
    }
    const rules = await storage.find('analysis-rule', Object.keys(criteria).length > 0 ? criteria : undefined);

    // Retrieve all program facts
    const facts = await storage.find('analysis-fact', {});

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

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const rule = input.rule as string;

    const record = await storage.get('analysis-rule', rule);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      rule: record.id as string,
      name: record.name as string,
      engine: record.engine as string,
      severity: record.severity as string,
      category: record.category as string,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetAnalysisRuleCounter(): void {
  idCounter = 0;
}
