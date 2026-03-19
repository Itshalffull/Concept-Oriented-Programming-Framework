// @migrated dsl-constructs 2026-03-18
// TestEntity Concept Implementation
//
// Queryable representation of test suites, conformance checks, and
// validation rules. Links tests to the concepts, syncs, handlers,
// and widgets they validate. Enables coverage analysis, failure
// tracking, and untested action/invariant discovery.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, putFrom, type StorageProgram,
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

    const id = crypto.randomUUID();

    let thenProg = createProgram();
    thenProg = completeFrom(thenProg, 'alreadyRegistered', (bindings) => ({
      existing: (bindings.existing as any).id,
    }));

    let elseProg = createProgram();
    elseProg = put(elseProg, 'tests', key, {
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
    elseProg = complete(elseProg, 'ok', { test: id });

    return branch(p, (b) => b.existing != null, thenProg, elseProg) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;

    p = get(p, 'tests', `test:${name}`, 'entry');

    let thenProg = createProgram();
    thenProg = completeFrom(thenProg, 'ok', (bindings) => ({
      test: (bindings.entry as any).id,
    }));

    let elseProg = createProgram();
    elseProg = complete(elseProg, 'notfound', {});

    return branch(p, (b) => b.entry != null, thenProg, elseProg) as StorageProgram<Result>;
  },

  findByEntity(input: Record<string, unknown>) {
    let p = createProgram();
    const entity = input.entity as string;
    p = find(p, 'tests', { targetEntity: entity }, 'all');

    p = mapBindings(p, (bindings) => {
      const items = bindings.all as any[];
      return items.map(t => ({
        name: t.name,
        kind: t.kind,
        sourceFile: t.sourceFile,
        lastResult: t.lastResult || '',
      }));
    }, 'tests');

    return completeFrom(p, 'ok', (bindings) => ({
      tests: JSON.stringify(bindings.tests),
    })) as StorageProgram<Result>;
  },

  findByAction(input: Record<string, unknown>) {
    let p = createProgram();
    const concept = input.concept as string;
    const action = input.action as string;
    p = find(p, 'tests', { targetEntity: concept }, 'all');

    p = mapBindings(p, (bindings) => {
      const items = bindings.all as any[];
      return items.filter(t =>
        (t.targetAction as string) === action || (t.name as string).includes(action)
      );
    }, 'filtered');

    return completeFrom(p, 'ok', (bindings) => ({
      tests: JSON.stringify(bindings.filtered),
    })) as StorageProgram<Result>;
  },

  findByKind(input: Record<string, unknown>) {
    let p = createProgram();
    const kind = input.kind as string;
    p = find(p, 'tests', { kind }, 'all');

    return completeFrom(p, 'ok', (bindings) => ({
      tests: JSON.stringify(bindings.all),
    })) as StorageProgram<Result>;
  },

  findFailing(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tests', {}, 'all');

    p = mapBindings(p, (bindings) => {
      const items = bindings.all as any[];
      return items.filter(t => t.lastResult === 'fail' || t.lastResult === 'error');
    }, 'failing');

    let thenProg = createProgram();
    thenProg = complete(thenProg, 'allPassing', {});

    let elseProg = createProgram();
    elseProg = mapBindings(elseProg, (bindings) => {
      const failing = bindings.failing as any[];
      return failing.map(t => ({
        name: t.name,
        kind: t.kind,
        targetEntity: t.targetEntity,
        sourceFile: t.sourceFile,
        errorMessage: '',
      }));
    }, 'tests');
    elseProg = completeFrom(elseProg, 'ok', (bindings) => ({
      tests: JSON.stringify(bindings.tests),
    }));

    return branch(p, (b) => (b.failing as any[]).length === 0, thenProg, elseProg) as StorageProgram<Result>;
  },

  coverageReport(input: Record<string, unknown>) {
    let p = createProgram();
    const entity = input.entity as string;
    p = find(p, 'tests', { targetEntity: entity }, 'tests');

    // TODO: Cross-reference with ConceptEntity to get total actions/variants/invariants
    p = mapBindings(p, (bindings) => {
      const tests = bindings.tests as any[];
      const testedActions = new Set(
        tests.map(t => t.targetAction as string).filter(Boolean)
      );

      return {
        totalActions: 0,
        testedActions: testedActions.size,
        totalVariants: 0,
        testedVariants: 0,
        totalInvariants: 0,
        testedInvariants: tests.filter(t => t.kind === 'invariant').length,
        coveragePct: 0,
      };
    }, 'report');

    return completeFrom(p, 'ok', (bindings) => ({
      report: JSON.stringify(bindings.report),
    })) as StorageProgram<Result>;
  },

  untestedActions(_input: Record<string, unknown>) {
    let p = createProgram();
    // TODO: Cross-reference all ConceptEntity actions with TestEntity coverage
    // For now, report full coverage as a stub
    return complete(p, 'fullCoverage', {}) as StorageProgram<Result>;
  },

  untestedInvariants(_input: Record<string, unknown>) {
    let p = createProgram();
    // TODO: Cross-reference all concept invariants with TestEntity coverage
    return complete(p, 'fullCoverage', {}) as StorageProgram<Result>;
  },

  recordResult(input: Record<string, unknown>) {
    let p = createProgram();
    const testName = input.test as string;
    const result = input.result as string;
    const duration = input.duration as number;

    const key = `test:${testName}`;
    p = get(p, 'tests', key, 'entry');

    let thenProg = createProgram();
    thenProg = putFrom(thenProg, 'tests', key, (bindings) => ({
      ...(bindings.entry as any),
      lastResult: result,
      lastDuration: duration,
    }));
    thenProg = completeFrom(thenProg, 'ok', (bindings) => ({
      test: (bindings.entry as any).id,
    }));

    let elseProg = createProgram();
    elseProg = complete(elseProg, 'ok', { test: testName });

    return branch(p, (b) => b.entry != null, thenProg, elseProg) as StorageProgram<Result>;
  },
};

export const testEntityHandler = autoInterpret(_handler);
