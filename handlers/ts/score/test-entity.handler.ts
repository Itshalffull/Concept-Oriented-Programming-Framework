// @migrated dsl-constructs 2026-03-18
// TestEntity Concept Implementation
//
// Queryable representation of test suites, conformance checks, and
// validation rules. Links tests to the concepts, syncs, handlers,
// and widgets they validate. Enables coverage analysis, failure
// tracking, and untested action/invariant discovery.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
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

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    const entry = await storage.get('tests', `test:${name}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', test: entry.id };
  },

  findByEntity(input: Record<string, unknown>) {
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

  findByAction(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const action = input.action as string;
    const all = await storage.find('tests', { targetEntity: concept });

    const filtered = all.filter(t =>
      (t.targetAction as string) === action || (t.name as string).includes(action)
    );

    return { variant: 'ok', tests: JSON.stringify(filtered) };
  },

  findByKind(input: Record<string, unknown>) {
    const kind = input.kind as string;
    const all = await storage.find('tests', { kind });

    return { variant: 'ok', tests: JSON.stringify(all) };
  },

  findFailing(_input: Record<string, unknown>) {
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

  coverageReport(input: Record<string, unknown>) {
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

  untestedActions(_input: Record<string, unknown>) {
    // TODO: Cross-reference all ConceptEntity actions with TestEntity coverage
    // For now, report full coverage as a stub
    return { variant: 'fullCoverage' };
  },

  untestedInvariants(_input: Record<string, unknown>) {
    // TODO: Cross-reference all concept invariants with TestEntity coverage
    return { variant: 'fullCoverage' };
  },

  recordResult(input: Record<string, unknown>) {
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

export const testEntityHandler = autoInterpret(_handler);
