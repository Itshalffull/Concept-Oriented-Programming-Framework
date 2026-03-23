// @clef-handler style=functional
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
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const name = input.name as string;
    const sourceFile = input.sourceFile as string;
    const kind = input.kind as string;
    const targetEntity = input.targetEntity as string;

    p = find(p, 'tests', { name }, 'existingList');

    const id = crypto.randomUUID();
    const key = `test:${id}`;

    let thenProg = createProgram();
    thenProg = completeFrom(thenProg, 'alreadyRegistered', (bindings) => ({
      existing: ((bindings.existingList as any[])[0]).id,
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

    return branch(p, (b) => (b.existingList as any[]).length > 0, thenProg, elseProg) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const name = input.name as string;

    p = find(p, 'tests', { name }, 'matches');

    let thenProg = createProgram();
    thenProg = completeFrom(thenProg, 'ok', (bindings) => ({
      test: ((bindings.matches as any[])[0]).id,
    }));

    let elseProg = createProgram();
    elseProg = complete(elseProg, 'notfound', {});

    return branch(p, (b) => (b.matches as any[]).length > 0, thenProg, elseProg) as StorageProgram<Result>;
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

    return branch(p, (b) => (b.all as any[]).length === 0,
      (errP) => complete(errP, 'error', { message: `No tests found for kind "${kind}"` }),
      (okP) => completeFrom(okP, 'ok', (bindings) => ({
        tests: JSON.stringify(bindings.all),
      })),
    ) as StorageProgram<Result>;
  },

  findFailing(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tests', {}, 'all');

    return branch(p, (b) => (b.all as any[]).length === 0,
      (errP) => complete(errP, 'error', { message: 'No tests registered' }),
      (okP) => {
        let bp = mapBindings(okP, (bindings) => {
          const items = bindings.all as any[];
          return items.filter(t => t.lastResult === 'fail' || t.lastResult === 'error');
        }, 'failing');
        return branch(bp, (b) => (b.failing as any[]).length === 0,
          (noneP) => complete(noneP, 'ok', {}),
          (someP) => completeFrom(someP, 'ok', (bindings) => ({
            tests: JSON.stringify((bindings.failing as any[]).map(t => ({
              name: t.name,
              kind: t.kind,
              targetEntity: t.targetEntity,
              sourceFile: t.sourceFile,
              errorMessage: '',
            }))),
          })),
        );
      },
    ) as StorageProgram<Result>;
  },

  coverageReport(input: Record<string, unknown>) {
    let p = createProgram();
    const entity = input.entity as string;
    p = find(p, 'tests', { targetEntity: entity }, 'tests');

    return branch(p, (b) => (b.tests as any[]).length === 0,
      (errP) => complete(errP, 'error', { message: `No tests found for entity "${entity}"` }),
      (okP) => {
        let bp = mapBindings(okP, (bindings) => {
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
        return completeFrom(bp, 'ok', (bindings) => ({
          report: JSON.stringify(bindings.report),
        }));
      },
    ) as StorageProgram<Result>;
  },

  untestedActions(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tests', {}, 'all');
    return branch(p, (b) => (b.all as any[]).length === 0,
      (errP) => complete(errP, 'error', { message: 'No tests registered' }),
      (okP) => complete(okP, 'ok', {}),
    ) as StorageProgram<Result>;
  },

  untestedInvariants(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tests', {}, 'all');
    return branch(p, (b) => (b.all as any[]).length === 0,
      (errP) => complete(errP, 'error', { message: 'No tests registered' }),
      (okP) => complete(okP, 'ok', {}),
    ) as StorageProgram<Result>;
  },

  recordResult(input: Record<string, unknown>) {
    if (!input.result || (typeof input.result === 'string' && (input.result as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'result is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const testId = input.test as string;
    const result = input.result as string;
    const duration = input.duration as number;

    const key = `test:${testId}`;
    p = get(p, 'tests', key, 'entry');

    let thenProg = createProgram();
    thenProg = putFrom(thenProg, 'tests', key, (bindings) => ({
      ...(bindings.entry as any),
      lastResult: result,
      lastDuration: duration,
    }));
    thenProg = complete(thenProg, 'ok', { test: testId });

    let elseProg = createProgram();
    elseProg = complete(elseProg, 'ok', { test: testId });

    return branch(p, (b) => b.entry != null, thenProg, elseProg) as StorageProgram<Result>;
  },
};

export const testEntityHandler = autoInterpret(_handler);
