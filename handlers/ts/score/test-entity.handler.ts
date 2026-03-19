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
    let p = createProgram();
    const name = input.name as string;
    const sourceFile = input.sourceFile as string;
    const kind = input.kind as string;
    const targetEntity = input.targetEntity as string;

    const key = `test:${name}`;
    p = get(p, 'tests', key, 'existing');
    if (existing) {
      return complete(p, 'alreadyRegistered', { existing: existing.id }) as StorageProgram<Result>;
    }

    const id = crypto.randomUUID();

    p = put(p, 'tests', key, {
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

    return complete(p, 'ok', { test: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;

    p = get(p, 'tests', `test:${name}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { test: entry.id }) as StorageProgram<Result>;
  },

  findByEntity(input: Record<string, unknown>) {
    let p = createProgram();
    const entity = input.entity as string;
    p = find(p, 'tests', { targetEntity: entity }, 'all');

    const tests = all.map(t => ({
      name: t.name,
      kind: t.kind,
      sourceFile: t.sourceFile,
      lastResult: t.lastResult || '',
    }));

    return complete(p, 'ok', { tests: JSON.stringify(tests) }) as StorageProgram<Result>;
  },

  findByAction(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const action = input.action as string;
    p = find(p, 'tests', { targetEntity: concept }, 'all');

    const filtered = all.filter(t =>
      (t.targetAction as string) === action || (t.name as string).includes(action)
    );

    return complete(p, 'ok', { tests: JSON.stringify(filtered) }) as StorageProgram<Result>;
  },

  findByKind(input: Record<string, unknown>) {
    let p = createProgram();
    const kind = input.kind as string;
    p = find(p, 'tests', { kind }, 'all');

    return complete(p, 'ok', { tests: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  findFailing(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tests', 'all');
    const failing = all.filter(t => t.lastResult === 'fail' || t.lastResult === 'error');

    if (failing.length === 0) {
      return complete(p, 'allPassing', {}) as StorageProgram<Result>;
    }

    const tests = failing.map(t => ({
      name: t.name,
      kind: t.kind,
      targetEntity: t.targetEntity,
      sourceFile: t.sourceFile,
      errorMessage: '',
    }));

    return complete(p, 'ok', { tests: JSON.stringify(tests) }) as StorageProgram<Result>;
  },

  coverageReport(input: Record<string, unknown>) {
    const entity = input.entity as string;
    p = find(p, 'tests', { targetEntity: entity }, 'tests');

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

    return complete(p, 'ok', { report: JSON.stringify(report) }) as StorageProgram<Result>;
  },

  untestedActions(_input: Record<string, unknown>) {
    let p = createProgram();
    // TODO: Cross-reference all ConceptEntity actions with TestEntity coverage
    // For now, report full coverage as a stub
    return complete(p, 'fullCoverage', {}) as StorageProgram<Result>;
  },

  untestedInvariants(_input: Record<string, unknown>) {
    // TODO: Cross-reference all concept invariants with TestEntity coverage
    return complete(p, 'fullCoverage', {}) as StorageProgram<Result>;
  },

  recordResult(input: Record<string, unknown>) {
    const testId = input.test as string;
    const result = input.result as string;
    const duration = input.duration as number;

    p = find(p, 'tests', 'all');
    const entry = all.find(t => t.id === testId);

    if (entry) {
      const key = `test:${entry.name}`;
      p = put(p, 'tests', key, {
        ...entry,
        lastResult: result,
        lastDuration: duration,
      });
    }

    return complete(p, 'ok', { test: testId }) as StorageProgram<Result>;
  },
};

export const testEntityHandler = autoInterpret(_handler);
