// TestEntity Concept Implementation
//
// Queryable representation of test suites, conformance checks, and
// validation rules. Links tests to the concepts, syncs, handlers,
// and widgets they validate. Enables coverage analysis, failure
// tracking, and untested action/invariant discovery.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const testEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const name = input.name as string;
    const sourceFile = input.sourceFile as string;
    const kind = input.kind as string;
    const targetEntity = input.targetEntity as string;

    const key = `test:${name}`;
    const existing = await storage.get('tests', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();

    await storage.put('tests', key, {
      id,
      name,
      sourceFile,
      kind,
      targetEntity,
      symbol: name,
      startLine: 0,
      endLine: 0,
      targetAction: '',
      assertions: '[]',
      invariantRef: '',
      lastResult: '',
      lastDuration: 0,
    });

    return { variant: 'ok', test: id };
  },

  async get(input, storage) {
    const name = input.name as string;

    const entry = await storage.get('tests', `test:${name}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', test: entry.id };
  },

  async findByEntity(input, storage) {
    const entity = input.entity as string;
    const all = await storage.find('tests', { targetEntity: entity });

    const tests = all.map(t => ({
      name: t.name,
      kind: t.kind,
      sourceFile: t.sourceFile,
      lastResult: t.lastResult || '',
    }));

    return { variant: 'ok', tests: JSON.stringify(tests) };
  },

  async findByAction(input, storage) {
    const concept = input.concept as string;
    const action = input.action as string;
    const all = await storage.find('tests', { targetEntity: concept });

    const filtered = all.filter(t =>
      (t.targetAction as string) === action || (t.name as string).includes(action)
    );

    return { variant: 'ok', tests: JSON.stringify(filtered) };
  },

  async findByKind(input, storage) {
    const kind = input.kind as string;
    const all = await storage.find('tests', { kind });

    return { variant: 'ok', tests: JSON.stringify(all) };
  },

  async findFailing(_input, storage) {
    const all = await storage.find('tests');
    const failing = all.filter(t => t.lastResult === 'fail' || t.lastResult === 'error');

    if (failing.length === 0) {
      return { variant: 'allPassing' };
    }

    const tests = failing.map(t => ({
      name: t.name,
      kind: t.kind,
      targetEntity: t.targetEntity,
      sourceFile: t.sourceFile,
      errorMessage: '',
    }));

    return { variant: 'ok', tests: JSON.stringify(tests) };
  },

  async coverageReport(input, storage) {
    const entity = input.entity as string;
    const tests = await storage.find('tests', { targetEntity: entity });

    // TODO: Cross-reference with ConceptEntity to get total actions/variants/invariants
    const testedActions = new Set(
      tests.map(t => t.targetAction as string).filter(Boolean)
    );

    const report = {
      totalActions: 0,
      testedActions: testedActions.size,
      totalVariants: 0,
      testedVariants: 0,
      totalInvariants: 0,
      testedInvariants: tests.filter(t => t.kind === 'invariant').length,
      coveragePct: 0,
    };

    return { variant: 'ok', report: JSON.stringify(report) };
  },

  async untestedActions(_input, storage) {
    // TODO: Cross-reference all ConceptEntity actions with TestEntity coverage
    // For now, report full coverage as a stub
    return { variant: 'fullCoverage' };
  },

  async untestedInvariants(_input, storage) {
    // TODO: Cross-reference all concept invariants with TestEntity coverage
    return { variant: 'fullCoverage' };
  },

  async recordResult(input, storage) {
    const testId = input.test as string;
    const result = input.result as string;
    const duration = input.duration as number;

    const all = await storage.find('tests');
    const entry = all.find(t => t.id === testId);

    if (entry) {
      const key = `test:${entry.name}`;
      await storage.put('tests', key, {
        ...entry,
        lastResult: result,
        lastDuration: duration,
      });
    }

    return { variant: 'ok', test: testId };
  },
};
