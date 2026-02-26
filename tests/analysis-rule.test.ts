// ============================================================
// AnalysisRule Handler Tests
//
// Tests for declarative analysis rule creation, evaluation,
// and batch evaluation across different engine backends
// (datalog, graph-traversal, pattern-match).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  analysisRuleHandler,
  resetAnalysisRuleCounter,
} from '../implementations/typescript/analysis-rule.impl.js';

describe('AnalysisRule Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAnalysisRuleCounter();
  });

  // ----------------------------------------------------------
  // create action
  // ----------------------------------------------------------

  describe('create', () => {
    it('creates a rule with the pattern-match engine', async () => {
      const result = await analysisRuleHandler.create(
        {
          name: 'no-any',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'any', message: 'Avoid "any" type' }]),
          severity: 'warning',
          category: 'style',
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.rule).toBe('analysis-rule-1');
    });

    it('creates a rule with the datalog engine', async () => {
      const result = await analysisRuleHandler.create(
        {
          name: 'unused-import',
          engine: 'datalog',
          source: JSON.stringify([{ match: 'imports', message: 'Unused import' }]),
          severity: 'error',
          category: 'lint',
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.rule).toBe('analysis-rule-1');
    });

    it('creates a rule with the graph-traversal engine', async () => {
      const result = await analysisRuleHandler.create(
        {
          name: 'circular-dep',
          engine: 'graph-traversal',
          source: JSON.stringify([{ match: 'cycle', message: 'Circular dependency detected' }]),
          severity: 'error',
          category: 'architecture',
        },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.rule).toBe('analysis-rule-1');
    });

    it('returns invalidSyntax for an unknown engine', async () => {
      const result = await analysisRuleHandler.create(
        {
          name: 'bad-engine',
          engine: 'regex',
          source: '[]',
          severity: 'info',
          category: 'misc',
        },
        storage,
      );

      expect(result.variant).toBe('invalidSyntax');
      expect(result.message).toContain('Unknown engine');
      expect(result.message).toContain('regex');
    });

    it('returns invalidSyntax when source is not valid JSON', async () => {
      const result = await analysisRuleHandler.create(
        {
          name: 'broken-rule',
          engine: 'datalog',
          source: 'not json',
          severity: 'warning',
          category: 'lint',
        },
        storage,
      );

      expect(result.variant).toBe('invalidSyntax');
      expect(result.message).toContain('not valid JSON');
    });

    it('defaults severity to info for unrecognized severity values', async () => {
      const result = await analysisRuleHandler.create(
        {
          name: 'soft-rule',
          engine: 'pattern-match',
          source: '[]',
          severity: 'critical',
          category: 'misc',
        },
        storage,
      );

      expect(result.variant).toBe('ok');

      const getResult = await analysisRuleHandler.get(
        { rule: result.rule as string },
        storage,
      );
      expect(getResult.variant).toBe('ok');
      expect(getResult.severity).toBe('info');
    });

    it('increments IDs across multiple creates', async () => {
      const r1 = await analysisRuleHandler.create(
        { name: 'r1', engine: 'datalog', source: '[]', severity: 'info', category: 'a' },
        storage,
      );
      const r2 = await analysisRuleHandler.create(
        { name: 'r2', engine: 'datalog', source: '[]', severity: 'info', category: 'b' },
        storage,
      );

      expect(r1.rule).toBe('analysis-rule-1');
      expect(r2.rule).toBe('analysis-rule-2');
    });
  });

  // ----------------------------------------------------------
  // get action
  // ----------------------------------------------------------

  describe('get', () => {
    it('retrieves a created rule', async () => {
      await analysisRuleHandler.create(
        {
          name: 'test-rule',
          engine: 'pattern-match',
          source: '[]',
          severity: 'warning',
          category: 'style',
        },
        storage,
      );

      const result = await analysisRuleHandler.get(
        { rule: 'analysis-rule-1' },
        storage,
      );

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('test-rule');
      expect(result.engine).toBe('pattern-match');
      expect(result.severity).toBe('warning');
      expect(result.category).toBe('style');
    });

    it('returns notfound for a missing rule', async () => {
      const result = await analysisRuleHandler.get(
        { rule: 'nonexistent' },
        storage,
      );

      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // evaluate action
  // ----------------------------------------------------------

  describe('evaluate', () => {
    it('returns noFindings when no facts match', async () => {
      await analysisRuleHandler.create(
        {
          name: 'no-match',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'impossible', message: 'Will not match' }]),
          severity: 'warning',
          category: 'test',
        },
        storage,
      );

      const result = await analysisRuleHandler.evaluate(
        { rule: 'analysis-rule-1' },
        storage,
      );

      expect(result.variant).toBe('noFindings');
    });

    it('returns evaluationError when rule does not exist', async () => {
      const result = await analysisRuleHandler.evaluate(
        { rule: 'missing-rule' },
        storage,
      );

      expect(result.variant).toBe('evaluationError');
      expect(result.message).toContain('not found');
    });

    it('evaluates pattern-match engine against matching facts', async () => {
      // Create a rule that matches "any"
      await analysisRuleHandler.create(
        {
          name: 'no-any',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'any', message: 'Avoid "any" type' }]),
          severity: 'warning',
          category: 'style',
        },
        storage,
      );

      // Store a program fact containing "any"
      await storage.put('analysis-fact', 'fact-1', {
        symbol: 'myFunction',
        file: 'src/handler.ts',
        location: '10:5',
        type: 'any',
      });

      const result = await analysisRuleHandler.evaluate(
        { rule: 'analysis-rule-1' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const findings = JSON.parse(result.findings as string);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].message).toBe('Avoid "any" type');
      expect(findings[0].symbol).toBe('myFunction');
      expect(findings[0].file).toBe('src/handler.ts');
    });

    it('evaluates graph-traversal engine matching by kind', async () => {
      await analysisRuleHandler.create(
        {
          name: 'find-cycle',
          engine: 'graph-traversal',
          source: JSON.stringify([{ match: 'cycle', message: 'Cycle detected' }]),
          severity: 'error',
          category: 'architecture',
        },
        storage,
      );

      await storage.put('analysis-fact', 'fact-1', {
        kind: 'cycle',
        symbol: 'moduleA',
        file: 'src/a.ts',
        location: '1:1',
      });

      const result = await analysisRuleHandler.evaluate(
        { rule: 'analysis-rule-1' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const findings = JSON.parse(result.findings as string);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toBe('Cycle detected');
      expect(findings[0].symbol).toBe('moduleA');
    });

    it('evaluates datalog engine matching by relation', async () => {
      await analysisRuleHandler.create(
        {
          name: 'check-imports',
          engine: 'datalog',
          source: JSON.stringify([{ match: 'imports', message: 'Import found' }]),
          severity: 'info',
          category: 'analysis',
        },
        storage,
      );

      await storage.put('analysis-fact', 'fact-1', {
        relation: 'imports',
        symbol: 'lodash',
        file: 'src/utils.ts',
        location: '3:1',
      });

      const result = await analysisRuleHandler.evaluate(
        { rule: 'analysis-rule-1' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const findings = JSON.parse(result.findings as string);
      expect(findings.length).toBe(1);
      expect(findings[0].message).toBe('Import found');
    });

    it('matches multiple facts against multiple patterns', async () => {
      await analysisRuleHandler.create(
        {
          name: 'multi-pattern',
          engine: 'pattern-match',
          source: JSON.stringify([
            { match: 'any', message: 'Found "any"' },
            { match: 'unknown', message: 'Found "unknown"' },
          ]),
          severity: 'warning',
          category: 'types',
        },
        storage,
      );

      await storage.put('analysis-fact', 'fact-1', {
        symbol: 'fn1',
        file: 'a.ts',
        location: '1:1',
        type: 'any',
      });
      await storage.put('analysis-fact', 'fact-2', {
        symbol: 'fn2',
        file: 'b.ts',
        location: '2:1',
        type: 'unknown',
      });

      const result = await analysisRuleHandler.evaluate(
        { rule: 'analysis-rule-1' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const findings = JSON.parse(result.findings as string);
      expect(findings.length).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // evaluateAll action
  // ----------------------------------------------------------

  describe('evaluateAll', () => {
    it('evaluates all rules and returns combined results', async () => {
      await analysisRuleHandler.create(
        {
          name: 'rule-a',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'todo', message: 'TODO comment found' }]),
          severity: 'info',
          category: 'hygiene',
        },
        storage,
      );
      await analysisRuleHandler.create(
        {
          name: 'rule-b',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'fixme', message: 'FIXME comment found' }]),
          severity: 'warning',
          category: 'hygiene',
        },
        storage,
      );

      await storage.put('analysis-fact', 'f1', {
        symbol: 'handler',
        file: 'x.ts',
        location: '5:1',
        comment: 'todo: refactor',
      });

      const result = await analysisRuleHandler.evaluateAll({}, storage);

      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(2);
      // First rule finds a match (todo), second does not (fixme)
      const ruleA = results.find((r: { rule: string }) => r.rule === 'analysis-rule-1');
      expect(ruleA.findingCount).toBe(1);
    });

    it('filters by category when provided', async () => {
      await analysisRuleHandler.create(
        {
          name: 'style-rule',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'any', message: 'Style issue' }]),
          severity: 'warning',
          category: 'style',
        },
        storage,
      );
      await analysisRuleHandler.create(
        {
          name: 'arch-rule',
          engine: 'pattern-match',
          source: JSON.stringify([{ match: 'any', message: 'Arch issue' }]),
          severity: 'error',
          category: 'architecture',
        },
        storage,
      );

      await storage.put('analysis-fact', 'f1', {
        symbol: 'x',
        file: 'a.ts',
        location: '1:1',
        type: 'any',
      });

      const result = await analysisRuleHandler.evaluateAll(
        { category: 'style' },
        storage,
      );

      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(1);
      expect(results[0].rule).toBe('analysis-rule-1');
    });

    it('returns empty results when no rules exist', async () => {
      const result = await analysisRuleHandler.evaluateAll({}, storage);

      expect(result.variant).toBe('ok');
      const results = JSON.parse(result.results as string);
      expect(results.length).toBe(0);
    });
  });
});
