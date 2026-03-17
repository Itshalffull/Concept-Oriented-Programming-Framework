// ============================================================
// Monadic Concept Handler Tests
//
// Tests all 9 monadic concept handlers:
// - Bootstrap (imperative): StorageProgram, ProgramInterpreter, FunctionalHandler
// - Functional (return StorageProgram): ProgramAnalysis, ProgramCache,
//   ReadWriteSetProvider, CommutativityProvider, DeadBranchProvider,
//   InvariantExtractionProvider
//
// See Architecture doc Sections 16.11, 16.12
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { storageProgramHandler } from '../handlers/ts/monadic/storage-program.handler.js';
import { programInterpreterHandler } from '../handlers/ts/monadic/program-interpreter.handler.js';
import { functionalHandlerHandler } from '../handlers/ts/monadic/functional-handler.handler.js';
import { programAnalysisHandler } from '../handlers/ts/monadic/program-analysis.handler.js';
import { programCacheHandler } from '../handlers/ts/monadic/program-cache.handler.js';
import { readWriteSetProviderHandler } from '../handlers/ts/monadic/providers/read-write-set-provider.handler.js';
import { commutativityProviderHandler } from '../handlers/ts/monadic/providers/commutativity-provider.handler.js';
import { deadBranchProviderHandler } from '../handlers/ts/monadic/providers/dead-branch-provider.handler.js';
import { invariantExtractionProviderHandler } from '../handlers/ts/monadic/providers/invariant-extraction-provider.handler.js';
import {
  extractReadSet,
  extractWriteSet,
  classifyPurity,
  type StorageProgram,
} from '../runtime/storage-program.js';

/**
 * Helper: extract the pure return value from a StorageProgram.
 * Walks instructions to find the first 'pure' tag and returns its value.
 */
function getPureValue(program: StorageProgram<unknown>): Record<string, unknown> | null {
  for (const instr of program.instructions) {
    if (instr.tag === 'pure') return instr.value as Record<string, unknown>;
    if (instr.tag === 'branch') {
      const thenVal = getPureValue(instr.thenBranch as StorageProgram<unknown>);
      const elseVal = getPureValue(instr.elseBranch as StorageProgram<unknown>);
      return thenVal || elseVal;
    }
  }
  return null;
}

// ============================================================
// StorageProgram Concept (Bootstrap — Imperative)
// ============================================================

describe('StorageProgram Concept', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a new program successfully', async () => {
      const result = await storageProgramHandler.create({ program: 'prog-1' }, storage);
      expect(result.variant).toBe('ok');
    });

    it('returns exists when program already created', async () => {
      await storageProgramHandler.create({ program: 'prog-1' }, storage);
      const result = await storageProgramHandler.create({ program: 'prog-1' }, storage);
      expect(result.variant).toBe('exists');
    });

    it('creates multiple distinct programs', async () => {
      const r1 = await storageProgramHandler.create({ program: 'a' }, storage);
      const r2 = await storageProgramHandler.create({ program: 'b' }, storage);
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });

    it('initializes program with empty instructions and not terminated', async () => {
      await storageProgramHandler.create({ program: 'prog-1' }, storage);
      const stored = await storage.get('programs', 'prog-1');
      expect(stored).not.toBeNull();
      expect(stored!.instructions).toEqual([]);
      expect(stored!.bindings).toEqual([]);
      expect(stored!.terminated).toBe(false);
    });
  });

  describe('get', () => {
    it('appends a get instruction to an existing program', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      const result = await storageProgramHandler.get(
        { program: 'p1', relation: 'users', key: 'u1', bindAs: 'user' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.program).toBe('p1');

      const stored = await storage.get('programs', 'p1');
      const instructions = stored!.instructions as unknown[];
      expect(instructions).toHaveLength(1);
      expect(instructions[0]).toEqual({ tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' });
    });

    it('returns notfound for nonexistent program', async () => {
      const result = await storageProgramHandler.get(
        { program: 'missing', relation: 'r', key: 'k', bindAs: 'b' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed for terminated program', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      await storageProgramHandler.pure({ program: 'p1', variant: 'done', output: 'val' }, storage);
      const result = await storageProgramHandler.get(
        { program: 'p1', relation: 'r', key: 'k', bindAs: 'b' },
        storage,
      );
      expect(result.variant).toBe('sealed');
    });

    it('appends multiple get instructions in sequence', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      await storageProgramHandler.get({ program: 'p1', relation: 'a', key: 'k1', bindAs: 'x' }, storage);
      await storageProgramHandler.get({ program: 'p1', relation: 'b', key: 'k2', bindAs: 'y' }, storage);

      const stored = await storage.get('programs', 'p1');
      expect((stored!.instructions as unknown[]).length).toBe(2);
    });
  });

  describe('find', () => {
    it('appends a find instruction to an existing program', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      const result = await storageProgramHandler.find(
        { program: 'p1', relation: 'users', criteria: 'active=true', bindAs: 'activeUsers' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound for nonexistent program', async () => {
      const result = await storageProgramHandler.find(
        { program: 'no', relation: 'r', criteria: 'c', bindAs: 'b' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed for terminated program', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      await storageProgramHandler.pure({ program: 'p1', variant: 'done', output: '' }, storage);
      const result = await storageProgramHandler.find(
        { program: 'p1', relation: 'r', criteria: 'c', bindAs: 'b' },
        storage,
      );
      expect(result.variant).toBe('sealed');
    });
  });

  describe('put', () => {
    it('appends a put instruction', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      const result = await storageProgramHandler.put(
        { program: 'p1', relation: 'users', key: 'u1', value: 'data' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound for nonexistent program', async () => {
      const result = await storageProgramHandler.put(
        { program: 'missing', relation: 'r', key: 'k', value: 'v' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed for terminated program', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      await storageProgramHandler.pure({ program: 'p1', variant: 'ok', output: 'x' }, storage);
      const result = await storageProgramHandler.put(
        { program: 'p1', relation: 'r', key: 'k', value: 'v' },
        storage,
      );
      expect(result.variant).toBe('sealed');
    });
  });

  describe('del', () => {
    it('appends a del instruction', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      const result = await storageProgramHandler.del(
        { program: 'p1', relation: 'users', key: 'u1' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound for nonexistent program', async () => {
      const result = await storageProgramHandler.del(
        { program: 'missing', relation: 'r', key: 'k' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed for terminated program', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      await storageProgramHandler.pure({ program: 'p1', variant: 'ok', output: '' }, storage);
      const result = await storageProgramHandler.del(
        { program: 'p1', relation: 'r', key: 'k' },
        storage,
      );
      expect(result.variant).toBe('sealed');
    });
  });

  describe('branch', () => {
    it('appends a branch instruction when both branches exist', async () => {
      await storageProgramHandler.create({ program: 'main' }, storage);
      await storageProgramHandler.create({ program: 'thenP' }, storage);
      await storageProgramHandler.create({ program: 'elseP' }, storage);

      const result = await storageProgramHandler.branch(
        { program: 'main', condition: 'x > 0', thenBranch: 'thenP', elseBranch: 'elseP' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns notfound when main program missing', async () => {
      await storageProgramHandler.create({ program: 'thenP' }, storage);
      await storageProgramHandler.create({ program: 'elseP' }, storage);
      const result = await storageProgramHandler.branch(
        { program: 'missing', condition: 'c', thenBranch: 'thenP', elseBranch: 'elseP' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns notfound when then-branch missing', async () => {
      await storageProgramHandler.create({ program: 'main' }, storage);
      await storageProgramHandler.create({ program: 'elseP' }, storage);
      const result = await storageProgramHandler.branch(
        { program: 'main', condition: 'c', thenBranch: 'noThen', elseBranch: 'elseP' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed for terminated program', async () => {
      await storageProgramHandler.create({ program: 'main' }, storage);
      await storageProgramHandler.create({ program: 'thenP' }, storage);
      await storageProgramHandler.create({ program: 'elseP' }, storage);
      await storageProgramHandler.pure({ program: 'main', variant: 'ok', output: '' }, storage);

      const result = await storageProgramHandler.branch(
        { program: 'main', condition: 'c', thenBranch: 'thenP', elseBranch: 'elseP' },
        storage,
      );
      expect(result.variant).toBe('sealed');
    });
  });

  describe('pure', () => {
    it('terminates a program and appends pure instruction', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      const result = await storageProgramHandler.pure(
        { program: 'p1', variant: 'success', output: '42' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.get('programs', 'p1');
      expect(stored!.terminated).toBe(true);
    });

    it('returns notfound for nonexistent program', async () => {
      const result = await storageProgramHandler.pure(
        { program: 'missing', variant: 'ok', output: '' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns sealed if already terminated', async () => {
      await storageProgramHandler.create({ program: 'p1' }, storage);
      await storageProgramHandler.pure({ program: 'p1', variant: 'ok', output: 'a' }, storage);
      const result = await storageProgramHandler.pure(
        { program: 'p1', variant: 'ok', output: 'b' },
        storage,
      );
      expect(result.variant).toBe('sealed');
    });
  });

  describe('compose', () => {
    it('composes two existing programs', async () => {
      await storageProgramHandler.create({ program: 'first' }, storage);
      await storageProgramHandler.create({ program: 'second' }, storage);
      const result = await storageProgramHandler.compose(
        { first: 'first', second: 'second', bindAs: 'result' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.program).toBeTruthy();
    });

    it('returns notfound when first program missing', async () => {
      await storageProgramHandler.create({ program: 'second' }, storage);
      const result = await storageProgramHandler.compose(
        { first: 'missing', second: 'second', bindAs: 'r' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns notfound when second program missing', async () => {
      await storageProgramHandler.create({ program: 'first' }, storage);
      const result = await storageProgramHandler.compose(
        { first: 'first', second: 'missing', bindAs: 'r' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('composed program inherits terminated status from second', async () => {
      await storageProgramHandler.create({ program: 'first' }, storage);
      await storageProgramHandler.create({ program: 'second' }, storage);
      await storageProgramHandler.pure({ program: 'second', variant: 'ok', output: '' }, storage);

      const result = await storageProgramHandler.compose(
        { first: 'first', second: 'second', bindAs: 'r' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const composed = await storage.get('programs', result.program as string);
      expect(composed!.terminated).toBe(true);
    });
  });
});

// ============================================================
// ProgramInterpreter Concept (Bootstrap — Imperative)
// ============================================================

describe('ProgramInterpreter Concept', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers an interpreter with valid mode', async () => {
      const result = await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'pg', mode: 'live' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('accepts dry-run mode', async () => {
      const result = await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'dry-run' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('accepts replay mode', async () => {
      const result = await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'replay' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns invalidMode for unsupported mode', async () => {
      const result = await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'pg', mode: 'turbo' },
        storage,
      );
      expect(result.variant).toBe('invalidMode');
    });

    it('returns exists when interpreter already registered', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'pg', mode: 'live' },
        storage,
      );
      const result = await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'dry-run' },
        storage,
      );
      expect(result.variant).toBe('exists');
    });

    it('stores backend and mode in interpreter record', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'sqlite', mode: 'replay' },
        storage,
      );
      const stored = await storage.get('interpreters', 'interp-1');
      expect(stored!.backend).toBe('sqlite');
      expect(stored!.mode).toBe('replay');
    });
  });

  describe('execute', () => {
    it('executes a program against a registered interpreter', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'live' },
        storage,
      );
      const result = await programInterpreterHandler.execute(
        { interpreter: 'interp-1', program: 'prog-data', snapshot: 'snap-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.executionId).toBeTruthy();
      expect(result.trace).toBeTruthy();
    });

    it('returns notfound for unregistered interpreter', async () => {
      const result = await programInterpreterHandler.execute(
        { interpreter: 'missing', program: 'p', snapshot: 's' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('stores execution record for later rollback', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'live' },
        storage,
      );
      const result = await programInterpreterHandler.execute(
        { interpreter: 'interp-1', program: 'prog-1', snapshot: 'snap-1' },
        storage,
      );
      const execution = await storage.get('executions', result.executionId as string);
      expect(execution).not.toBeNull();
      expect(execution!.program).toBe('prog-1');
    });
  });

  describe('dryRun', () => {
    it('returns output and empty mutations for registered interpreter', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'dry-run' },
        storage,
      );
      const result = await programInterpreterHandler.dryRun(
        { interpreter: 'interp-1', program: 'prog-data', snapshot: 'snap-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.mutations).toBe('[]');
    });

    it('returns notfound for unregistered interpreter', async () => {
      const result = await programInterpreterHandler.dryRun(
        { interpreter: 'missing', program: 'p', snapshot: 's' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('does not create an execution record', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'dry-run' },
        storage,
      );
      await programInterpreterHandler.dryRun(
        { interpreter: 'interp-1', program: 'prog-1', snapshot: 'snap-1' },
        storage,
      );
      const executions = await storage.find('executions');
      expect(executions).toHaveLength(0);
    });
  });

  describe('rollback', () => {
    it('rolls back an existing execution', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'live' },
        storage,
      );
      const exec = await programInterpreterHandler.execute(
        { interpreter: 'interp-1', program: 'prog-1', snapshot: 'snap-1' },
        storage,
      );
      const result = await programInterpreterHandler.rollback(
        { interpreter: 'interp-1', executionId: exec.executionId as string },
        storage,
      );
      expect(result.variant).toBe('ok');

      const execution = await storage.get('executions', exec.executionId as string);
      expect(execution).toBeNull();
    });

    it('returns notfound for unregistered interpreter', async () => {
      const result = await programInterpreterHandler.rollback(
        { interpreter: 'missing', executionId: 'exec-1' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });

    it('returns notfound for nonexistent execution', async () => {
      await programInterpreterHandler.register(
        { interpreter: 'interp-1', backend: 'mem', mode: 'live' },
        storage,
      );
      const result = await programInterpreterHandler.rollback(
        { interpreter: 'interp-1', executionId: 'exec-does-not-exist' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });
});

// ============================================================
// FunctionalHandler Concept (Bootstrap — Imperative)
// ============================================================

describe('FunctionalHandler Concept', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('register', () => {
    it('registers a new handler', async () => {
      const result = await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns exists for duplicate handler name', async () => {
      await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      const result = await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'Task', action: 'assign', purity: 'impure' },
        storage,
      );
      expect(result.variant).toBe('exists');
    });

    it('returns exists for duplicate concept/action pair', async () => {
      await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      const result = await functionalHandlerHandler.register(
        { handler: 'h2', concept: 'User', action: 'create', purity: 'impure' },
        storage,
      );
      expect(result.variant).toBe('exists');
    });

    it('allows same concept with different actions', async () => {
      const r1 = await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      const r2 = await functionalHandlerHandler.register(
        { handler: 'h2', concept: 'User', action: 'delete', purity: 'impure' },
        storage,
      );
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
    });

    it('stores purity metadata', async () => {
      await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      const stored = await storage.get('handlers', 'h1');
      expect(stored!.purity).toBe('pure');
      expect(stored!.concept).toBe('User');
    });
  });

  describe('build', () => {
    it('builds a program from a registered handler', async () => {
      await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      const result = await functionalHandlerHandler.build(
        { handler: 'h1', input: 'user-data' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.program).toBeTruthy();
    });

    it('returns notfound for unregistered handler', async () => {
      const result = await functionalHandlerHandler.build(
        { handler: 'missing', input: 'data' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  describe('list', () => {
    it('returns empty list when no handlers for concept', async () => {
      const result = await functionalHandlerHandler.list({ concept: 'Nonexistent' }, storage);
      expect(result.variant).toBe('ok');
      const handlers = JSON.parse(result.handlers as string);
      expect(handlers).toHaveLength(0);
    });

    it('lists handlers for a specific concept', async () => {
      await functionalHandlerHandler.register(
        { handler: 'h1', concept: 'User', action: 'create', purity: 'pure' },
        storage,
      );
      await functionalHandlerHandler.register(
        { handler: 'h2', concept: 'User', action: 'delete', purity: 'impure' },
        storage,
      );
      const result = await functionalHandlerHandler.list({ concept: 'User' }, storage);
      const handlers = JSON.parse(result.handlers as string);
      expect(handlers).toHaveLength(2);
    });
  });
});

// ============================================================
// ProgramAnalysis Concept (Functional Handler — returns StorageProgram)
// ============================================================

describe('ProgramAnalysis Concept (Functional)', () => {
  describe('registerProvider', () => {
    it('returns a StorageProgram that reads then branches on existence', () => {
      const program = programAnalysisHandler.registerProvider({ name: 'rw-set', kind: 'static' });
      expect(program.instructions.length).toBeGreaterThan(0);
      const tags = program.instructions.map(i => i.tag);
      expect(tags).toContain('get');
      expect(tags).toContain('branch');
    });

    it('reads from and writes to providers relation', () => {
      const program = programAnalysisHandler.registerProvider({ name: 'prov-a', kind: 'structural' });
      expect(extractReadSet(program).has('providers')).toBe(true);
      expect(extractWriteSet(program).has('providers')).toBe(true);
    });

    it('branch contains ok and exists variants', () => {
      const program = programAnalysisHandler.registerProvider({ name: 'prov', kind: 'static' });
      const branchInstr = program.instructions.find(i => i.tag === 'branch');
      expect(branchInstr).toBeDefined();
      if (branchInstr && branchInstr.tag === 'branch') {
        const thenVal = getPureValue(branchInstr.thenBranch as StorageProgram<unknown>);
        const elseVal = getPureValue(branchInstr.elseBranch as StorageProgram<unknown>);
        expect(thenVal?.variant).toBe('exists');
        expect(elseVal?.variant).toBe('ok');
      }
    });
  });

  describe('run', () => {
    it('checks provider existence then writes result', () => {
      const program = programAnalysisHandler.run({ program: 'my-prog', provider: 'rw-set' });
      expect(extractReadSet(program).has('providers')).toBe(true);
      expect(extractWriteSet(program).has('results')).toBe(true);
    });

    it('branch contains providerNotFound and ok variants', () => {
      const program = programAnalysisHandler.run({ program: 'my-prog', provider: 'rw-set' });
      const branchInstr = program.instructions.find(i => i.tag === 'branch');
      if (branchInstr && branchInstr.tag === 'branch') {
        const notFound = getPureValue(branchInstr.thenBranch as StorageProgram<unknown>);
        const found = getPureValue(branchInstr.elseBranch as StorageProgram<unknown>);
        expect(notFound?.variant).toBe('providerNotFound');
        expect(found?.variant).toBe('ok');
      }
    });
  });

  describe('runAll', () => {
    it('finds all providers and terminates with ok', () => {
      const program = programAnalysisHandler.runAll({ program: 'my-prog' });
      expect(extractReadSet(program).has('providers')).toBe(true);
      expect(program.terminated).toBe(true);
      expect(getPureValue(program)?.variant).toBe('ok');
    });
  });

  describe('listProviders', () => {
    it('is classified as read-only', () => {
      const program = programAnalysisHandler.listProviders({});
      expect(classifyPurity(program)).toBe('read-only');
    });

    it('terminates with ok variant', () => {
      const program = programAnalysisHandler.listProviders({});
      expect(program.terminated).toBe(true);
      expect(getPureValue(program)?.variant).toBe('ok');
    });
  });
});

// ============================================================
// ProgramCache Concept (Functional Handler — returns StorageProgram)
// ============================================================

describe('ProgramCache Concept (Functional)', () => {
  describe('lookup', () => {
    it('reads from entries relation', () => {
      const program = programCacheHandler.lookup({ programHash: 'ph1', stateHash: 'sh1' });
      expect(extractReadSet(program).has('entries')).toBe(true);
    });

    it('uses composite cache key from programHash::stateHash', () => {
      const program = programCacheHandler.lookup({ programHash: 'ph1', stateHash: 'sh1' });
      const getInstr = program.instructions.find(i => i.tag === 'get');
      if (getInstr && getInstr.tag === 'get') {
        expect(getInstr.key).toBe('ph1::sh1');
      }
    });

    it('branches between miss and hit', () => {
      const program = programCacheHandler.lookup({ programHash: 'ph1', stateHash: 'sh1' });
      const branchInstr = program.instructions.find(i => i.tag === 'branch');
      expect(branchInstr).toBeDefined();
      if (branchInstr && branchInstr.tag === 'branch') {
        const miss = getPureValue(branchInstr.thenBranch as StorageProgram<unknown>);
        expect(miss?.variant).toBe('miss');
      }
    });

    it('writes back to entries on hit (update hit count)', () => {
      const program = programCacheHandler.lookup({ programHash: 'ph1', stateHash: 'sh1' });
      expect(extractWriteSet(program).has('entries')).toBe(true);
    });
  });

  describe('store', () => {
    it('reads and writes entries relation', () => {
      const program = programCacheHandler.store({ programHash: 'ph1', stateHash: 'sh1', result: 'val' });
      expect(extractReadSet(program).has('entries')).toBe(true);
      expect(extractWriteSet(program).has('entries')).toBe(true);
    });

    it('branches between exists and ok with entry key', () => {
      const program = programCacheHandler.store({ programHash: 'ph1', stateHash: 'sh1', result: 'val' });
      const branchInstr = program.instructions.find(i => i.tag === 'branch');
      if (branchInstr && branchInstr.tag === 'branch') {
        const exists = getPureValue(branchInstr.thenBranch as StorageProgram<unknown>);
        const ok = getPureValue(branchInstr.elseBranch as StorageProgram<unknown>);
        expect(exists?.variant).toBe('exists');
        expect(ok?.variant).toBe('ok');
        expect(ok?.entry).toBe('ph1::sh1');
      }
    });
  });

  describe('invalidateByState', () => {
    it('finds entries by stateHash and terminates ok', () => {
      const program = programCacheHandler.invalidateByState({ stateHash: 'sh1' });
      expect(extractReadSet(program).has('entries')).toBe(true);
      expect(program.terminated).toBe(true);
      expect(getPureValue(program)?.variant).toBe('ok');
    });
  });

  describe('invalidateByProgram', () => {
    it('finds entries by programHash and terminates ok', () => {
      const program = programCacheHandler.invalidateByProgram({ programHash: 'ph1' });
      expect(extractReadSet(program).has('entries')).toBe(true);
      expect(program.terminated).toBe(true);
      expect(getPureValue(program)?.variant).toBe('ok');
    });
  });

  describe('stats', () => {
    it('is classified as read-only', () => {
      const program = programCacheHandler.stats({});
      expect(classifyPurity(program)).toBe('read-only');
    });

    it('terminates with ok variant', () => {
      const program = programCacheHandler.stats({});
      expect(program.terminated).toBe(true);
      expect(getPureValue(program)?.variant).toBe('ok');
    });
  });
});

// ============================================================
// ReadWriteSetProvider (Functional Handler — returns StorageProgram)
// ============================================================

describe('ReadWriteSetProvider (Functional)', () => {
  describe('analyze — JSON format', () => {
    it('detects read-only program (only gets)', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
          { tag: 'find', relation: 'tasks', criteria: 'active', bindAs: 'tasks' },
        ],
      });
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.purity).toBe('read-only');

      const readSet = JSON.parse(pureVal?.readSet as string);
      expect(readSet).toContain('users');
      expect(readSet).toContain('tasks');
    });

    it('detects read-write program (has puts)', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
          { tag: 'put', relation: 'users', key: 'u1', value: 'updated' },
        ],
      });
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.purity).toBe('read-write');
    });

    it('detects pure program (no instructions)', () => {
      const program = JSON.stringify({ instructions: [] });
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.purity).toBe('pure');
    });

    it('del instructions go to write set', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'del', relation: 'sessions', key: 's1' }],
      });
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      expect(pureVal?.purity).toBe('read-write');
      const writeSet = JSON.parse(pureVal?.writeSet as string);
      expect(writeSet).toContain('sessions');
    });

    it('deduplicates relations in sets', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'users', key: 'u1', bindAs: 'a' },
          { tag: 'get', relation: 'users', key: 'u2', bindAs: 'b' },
          { tag: 'put', relation: 'users', key: 'u1', value: 'x' },
        ],
      });
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      const readSet = JSON.parse(pureVal?.readSet as string);
      expect(readSet).toEqual(['users']);
    });

    it('writes result to storage via put instruction', () => {
      const program = JSON.stringify({ instructions: [] });
      const sp = readWriteSetProviderHandler.analyze({ program });
      expect(extractWriteSet(sp).has('results')).toBe(true);
    });
  });

  describe('analyze — textual format', () => {
    it('parses semicolon-separated textual operations', () => {
      const program = 'get(users, u1); put(tasks, t1, data)';
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.purity).toBe('read-write');
    });

    it('handles find and del in textual format', () => {
      const program = 'find(orders, active); del(sessions, s1)';
      const sp = readWriteSetProviderHandler.analyze({ program });
      const pureVal = getPureValue(sp);
      expect(pureVal?.purity).toBe('read-write');
    });

    it('detects pure for empty textual input', () => {
      const sp = readWriteSetProviderHandler.analyze({ program: '' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.purity).toBe('pure');
    });
  });
});

// ============================================================
// CommutativityProvider (Functional Handler — returns StorageProgram)
// ============================================================

describe('CommutativityProvider (Functional)', () => {
  describe('check', () => {
    it('reports commutative for disjoint read/write sets', () => {
      const rwA = JSON.stringify({ r: ['users'], w: ['sessions'] });
      const rwB = JSON.stringify({ r: ['tasks'], w: ['labels'] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.commutes).toBe(true);
      expect((pureVal?.reason as string)).toContain('disjoint');
    });

    it('reports non-commutative for write-write conflict', () => {
      const rwA = JSON.stringify({ r: [], w: ['users'] });
      const rwB = JSON.stringify({ r: [], w: ['users'] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.commutes).toBe(false);
      expect((pureVal?.reason as string)).toContain('write-write conflict');
    });

    it('reports non-commutative for write-read conflict (A writes, B reads)', () => {
      const rwA = JSON.stringify({ r: [], w: ['orders'] });
      const rwB = JSON.stringify({ r: ['orders'], w: [] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.commutes).toBe(false);
      expect((pureVal?.reason as string)).toContain('write-read conflict');
    });

    it('reports non-commutative for write-read conflict (B writes, A reads)', () => {
      const rwA = JSON.stringify({ r: ['orders'], w: [] });
      const rwB = JSON.stringify({ r: [], w: ['orders'] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.commutes).toBe(false);
    });

    it('commutes when both have empty sets', () => {
      const rwA = JSON.stringify({ r: [], w: [] });
      const rwB = JSON.stringify({ r: [], w: [] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.commutes).toBe(true);
    });

    it('commutes when both only read the same relations', () => {
      const rwA = JSON.stringify({ r: ['users', 'tasks'], w: [] });
      const rwB = JSON.stringify({ r: ['users', 'tasks'], w: [] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.commutes).toBe(true);
    });

    it('reports multiple conflicts in reason', () => {
      const rwA = JSON.stringify({ r: ['x'], w: ['y', 'z'] });
      const rwB = JSON.stringify({ r: ['y'], w: ['x', 'z'] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      const pureVal = getPureValue(sp);
      expect(pureVal?.commutes).toBe(false);
      const reasons = (pureVal?.reason as string).split(';');
      expect(reasons.length).toBeGreaterThan(1);
    });

    it('handles invalid JSON by returning non-commutative', () => {
      const sp = commutativityProviderHandler.check(
        { readWriteSetsA: 'not json', readWriteSetsB: 'also not' },
      );
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.commutes).toBe(false);
    });

    it('writes result to storage', () => {
      const rwA = JSON.stringify({ r: [], w: [] });
      const rwB = JSON.stringify({ r: [], w: [] });
      const sp = commutativityProviderHandler.check({ readWriteSetsA: rwA, readWriteSetsB: rwB });
      expect(extractWriteSet(sp).has('results')).toBe(true);
    });
  });
});

// ============================================================
// DeadBranchProvider (Functional Handler — returns StorageProgram)
// ============================================================

describe('DeadBranchProvider (Functional)', () => {
  describe('analyze — JSON format', () => {
    it('detects dead else-branch when condition is true', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'branch', condition: 'true', thenBranch: 'thenP', elseBranch: 'elseP' },
        ],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');
      expect(pureVal?.totalCount).toBe(2);
      expect(pureVal?.reachableCount).toBe(1);

      const deadBranches = JSON.parse(pureVal?.deadBranches as string);
      expect(deadBranches).toHaveLength(1);
      expect(deadBranches[0]).toContain('else-branch');
    });

    it('detects dead then-branch when condition is false', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'branch', condition: 'false', thenBranch: 'thenP', elseBranch: 'elseP' },
        ],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.totalCount).toBe(2);
      expect(pureVal?.reachableCount).toBe(1);

      const deadBranches = JSON.parse(pureVal?.deadBranches as string);
      expect(deadBranches[0]).toContain('then-branch');
    });

    it('marks both branches reachable for dynamic conditions', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'branch', condition: 'x > 0', thenBranch: 'thenP', elseBranch: 'elseP' },
        ],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.totalCount).toBe(2);
      expect(pureVal?.reachableCount).toBe(2);
    });

    it('handles multiple branch instructions', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'branch', condition: 'true', thenBranch: 't1', elseBranch: 'e1' },
          { tag: 'branch', condition: 'false', thenBranch: 't2', elseBranch: 'e2' },
          { tag: 'branch', condition: 'dynamic', thenBranch: 't3', elseBranch: 'e3' },
        ],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.totalCount).toBe(6);
      expect(pureVal?.reachableCount).toBe(4);
    });

    it('handles program with no branches', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' }],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.totalCount).toBe(0);
      expect(pureVal?.reachableCount).toBe(0);
    });

    it('handles boolean true condition (not string)', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'branch', condition: true, thenBranch: 't', elseBranch: 'e' }],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      const deadBranches = JSON.parse(pureVal?.deadBranches as string);
      expect(deadBranches[0]).toContain('else-branch');
    });

    it('handles boolean false condition (not string)', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'branch', condition: false, thenBranch: 't', elseBranch: 'e' }],
      });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      const pureVal = getPureValue(sp);
      const deadBranches = JSON.parse(pureVal?.deadBranches as string);
      expect(deadBranches[0]).toContain('then-branch');
    });
  });

  describe('analyze — textual format', () => {
    it('detects dead else-branch in textual format', () => {
      const sp = deadBranchProviderHandler.analyze({ program: 'branch(true, thenP, elseP)', constraints: '' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.totalCount).toBe(2);
      expect(pureVal?.reachableCount).toBe(1);
    });

    it('detects dead then-branch in textual format', () => {
      const sp = deadBranchProviderHandler.analyze({ program: 'branch(false, thenP, elseP)', constraints: '' });
      const pureVal = getPureValue(sp);
      const deadBranches = JSON.parse(pureVal?.deadBranches as string);
      expect(deadBranches[0]).toContain('then-branch');
    });
  });

  describe('analyze — writes result to storage', () => {
    it('puts analysis result in results relation', () => {
      const program = JSON.stringify({ instructions: [] });
      const sp = deadBranchProviderHandler.analyze({ program, constraints: '{}' });
      expect(extractWriteSet(sp).has('results')).toBe(true);
    });
  });
});

// ============================================================
// InvariantExtractionProvider (Functional Handler — returns StorageProgram)
// ============================================================

describe('InvariantExtractionProvider (Functional)', () => {
  describe('extract — JSON format', () => {
    it('extracts postcondition for put instruction', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'put', relation: 'users', key: 'u1', value: 'data' }],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'UserSpec' });
      const pureVal = getPureValue(sp);
      expect(pureVal?.variant).toBe('ok');

      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties).toHaveLength(1);
      expect(properties[0]).toContain('postcondition');
      expect(properties[0]).toContain('users[u1]');
      expect(properties[0]).toContain('contains the written value');
    });

    it('extracts postcondition for del instruction', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'del', relation: 'sessions', key: 's1' }],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'SessionSpec' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties[0]).toContain('does not exist');
    });

    it('extracts frame conditions for read-only relations', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'config', key: 'c1', bindAs: 'cfg' },
          { tag: 'put', relation: 'users', key: 'u1', value: 'data' },
        ],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'AppSpec' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      const frameProps = properties.filter((p: string) => p.startsWith('frame:'));
      expect(frameProps).toHaveLength(1);
      expect(frameProps[0]).toContain('config');
    });

    it('no frame conditions when conceptSpec is empty', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'config', key: 'c1', bindAs: 'cfg' },
          { tag: 'put', relation: 'users', key: 'u1', value: 'data' },
        ],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: '' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      const frameProps = properties.filter((p: string) => p.startsWith('frame:'));
      expect(frameProps).toHaveLength(0);
    });

    it('no frame condition for relation that is both read and written', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'get', relation: 'users', key: 'u1', bindAs: 'user' },
          { tag: 'put', relation: 'users', key: 'u1', value: 'updated' },
        ],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'UserSpec' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      const frameProps = properties.filter((p: string) => p.startsWith('frame:'));
      expect(frameProps).toHaveLength(0);
    });

    it('handles empty instruction list', () => {
      const program = JSON.stringify({ instructions: [] });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'Spec' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties).toHaveLength(0);
    });

    it('extracts multiple postconditions from multiple writes', () => {
      const program = JSON.stringify({
        instructions: [
          { tag: 'put', relation: 'users', key: 'u1', value: 'a' },
          { tag: 'put', relation: 'tasks', key: 't1', value: 'b' },
          { tag: 'del', relation: 'sessions', key: 's1' },
        ],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'AppSpec' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties).toHaveLength(3);
    });
  });

  describe('extract — textual format', () => {
    it('extracts postcondition from textual put', () => {
      const sp = invariantExtractionProviderHandler.extract({ program: 'put(users, u1, data)', conceptSpec: '' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties).toHaveLength(1);
      expect(properties[0]).toContain('users[u1]');
    });

    it('extracts postcondition from textual del', () => {
      const sp = invariantExtractionProviderHandler.extract({ program: 'del(sessions, s1)', conceptSpec: '' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties[0]).toContain('does not exist');
    });

    it('handles empty textual program', () => {
      const sp = invariantExtractionProviderHandler.extract({ program: '', conceptSpec: '' });
      const pureVal = getPureValue(sp);
      const properties = JSON.parse(pureVal?.properties as string);
      expect(properties).toHaveLength(0);
    });
  });

  describe('extract — writes result to storage', () => {
    it('puts extraction result in results relation', () => {
      const program = JSON.stringify({
        instructions: [{ tag: 'put', relation: 'users', key: 'u1', value: 'v' }],
      });
      const sp = invariantExtractionProviderHandler.extract({ program, conceptSpec: 'Spec' });
      expect(extractWriteSet(sp).has('results')).toBe(true);
    });
  });
});

// ============================================================
// StorageProgram DSL integration tests
// ============================================================

describe('StorageProgram DSL', () => {
  it('functional handlers return terminated programs', () => {
    const sp = readWriteSetProviderHandler.analyze({
      program: JSON.stringify({ instructions: [] }),
    });
    expect(sp.terminated).toBe(true);
  });

  it('functional handlers return non-promise values (synchronous)', () => {
    const sp = commutativityProviderHandler.check({
      readWriteSetsA: JSON.stringify({ r: [], w: [] }),
      readWriteSetsB: JSON.stringify({ r: [], w: [] }),
    });
    // Not a Promise — it's a plain StorageProgram object
    expect(sp.instructions).toBeDefined();
    expect(sp.terminated).toBeDefined();
    expect(typeof (sp as unknown as Promise<unknown>).then).not.toBe('function');
  });

  it('classifyPurity works on functional handler output', () => {
    const readOnly = programCacheHandler.stats({});
    expect(classifyPurity(readOnly)).toBe('read-only');

    const readWrite = programCacheHandler.store({ programHash: 'p', stateHash: 's', result: 'r' });
    expect(classifyPurity(readWrite)).toBe('read-write');
  });
});

// ============================================================
// Interpreter Integration Tests
//
// Executes functional handler programs against real storage to
// validate end-to-end behavior through the interpreter.
// ============================================================

import { interpret } from '../runtime/interpreter.js';

/** Helper: build program from functional handler, then interpret against storage. */
async function execFunctional(
  handler: Record<string, (input: Record<string, unknown>) => unknown>,
  action: string,
  input: Record<string, unknown>,
  storage: ReturnType<typeof createInMemoryStorage>,
): Promise<Record<string, unknown>> {
  const program = handler[action](input);
  const result = await interpret(program as StorageProgram<unknown>, storage);
  return { variant: result.variant, ...result.output };
}

describe('ProgramAnalysis — Interpreted Execution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('registerProvider writes to storage then returns ok', async () => {
    const result = await execFunctional(programAnalysisHandler, 'registerProvider', { name: 'rw-set', kind: 'static' }, storage);
    expect(result.variant).toBe('ok');
    const stored = await storage.get('providers', 'rw-set');
    expect(stored).not.toBeNull();
    expect(stored!.kind).toBe('static');
  });

  it('registerProvider returns exists for duplicate', async () => {
    await execFunctional(programAnalysisHandler, 'registerProvider', { name: 'rw-set', kind: 'static' }, storage);
    const result = await execFunctional(programAnalysisHandler, 'registerProvider', { name: 'rw-set', kind: 'dynamic' }, storage);
    expect(result.variant).toBe('exists');
  });

  it('run returns providerNotFound for missing provider', async () => {
    const result = await execFunctional(programAnalysisHandler, 'run', { program: 'p', provider: 'missing' }, storage);
    expect(result.variant).toBe('providerNotFound');
  });

  it('run returns ok for existing provider and stores result', async () => {
    await execFunctional(programAnalysisHandler, 'registerProvider', { name: 'prov', kind: 'static' }, storage);
    const result = await execFunctional(programAnalysisHandler, 'run', { program: 'prog-1', provider: 'prov' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.analysis).toBeTruthy();
  });

  it('runAll returns ok variant', async () => {
    const result = await execFunctional(programAnalysisHandler, 'runAll', { program: 'prog-1' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('listProviders returns ok variant', async () => {
    const result = await execFunctional(programAnalysisHandler, 'listProviders', {}, storage);
    expect(result.variant).toBe('ok');
  });
});

describe('ProgramCache — Interpreted Execution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('lookup returns miss for uncached entry', async () => {
    const result = await execFunctional(programCacheHandler, 'lookup', { programHash: 'ph1', stateHash: 'sh1' }, storage);
    expect(result.variant).toBe('miss');
  });

  it('store then lookup returns hit', async () => {
    const storeResult = await execFunctional(programCacheHandler, 'store', { programHash: 'ph1', stateHash: 'sh1', result: 'cached' }, storage);
    expect(storeResult.variant).toBe('ok');
    expect(storeResult.entry).toBe('ph1::sh1');

    const lookupResult = await execFunctional(programCacheHandler, 'lookup', { programHash: 'ph1', stateHash: 'sh1' }, storage);
    expect(lookupResult.variant).toBe('hit');
    expect(lookupResult.entry).toBe('ph1::sh1');
  });

  it('store returns exists for duplicate', async () => {
    await execFunctional(programCacheHandler, 'store', { programHash: 'ph1', stateHash: 'sh1', result: 'val' }, storage);
    const result = await execFunctional(programCacheHandler, 'store', { programHash: 'ph1', stateHash: 'sh1', result: 'val2' }, storage);
    expect(result.variant).toBe('exists');
  });

  it('different state hash is a miss', async () => {
    await execFunctional(programCacheHandler, 'store', { programHash: 'ph1', stateHash: 'sh1', result: 'val' }, storage);
    const result = await execFunctional(programCacheHandler, 'lookup', { programHash: 'ph1', stateHash: 'sh2' }, storage);
    expect(result.variant).toBe('miss');
  });

  it('invalidateByState returns ok', async () => {
    const result = await execFunctional(programCacheHandler, 'invalidateByState', { stateHash: 'none' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('invalidateByProgram returns ok', async () => {
    const result = await execFunctional(programCacheHandler, 'invalidateByProgram', { programHash: 'none' }, storage);
    expect(result.variant).toBe('ok');
  });

  it('stats returns ok for empty cache', async () => {
    const result = await execFunctional(programCacheHandler, 'stats', {}, storage);
    expect(result.variant).toBe('ok');
  });
});

describe('ReadWriteSetProvider — Interpreted Execution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('analyze stores result in storage and returns ok', async () => {
    const program = JSON.stringify({ instructions: [{ tag: 'get', relation: 'users', key: 'u1', bindAs: 'u' }] });
    const result = await execFunctional(readWriteSetProviderHandler, 'analyze', { program }, storage);
    expect(result.variant).toBe('ok');
    expect(result.purity).toBe('read-only');
    expect(result.result).toBeTruthy();
    const stored = await storage.get('results', result.result as string);
    expect(stored).not.toBeNull();
  });

  it('analyze with empty program stores pure result', async () => {
    const result = await execFunctional(readWriteSetProviderHandler, 'analyze', { program: JSON.stringify({ instructions: [] }) }, storage);
    expect(result.variant).toBe('ok');
    expect(result.purity).toBe('pure');
  });

  it('analyze with textual format works through interpreter', async () => {
    const result = await execFunctional(readWriteSetProviderHandler, 'analyze', { program: 'get(users, u1); put(tasks, t1, val)' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.purity).toBe('read-write');
  });
});

describe('CommutativityProvider — Interpreted Execution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('check stores result and returns commutes=true for disjoint', async () => {
    const rwA = JSON.stringify({ r: ['a'], w: ['b'] });
    const rwB = JSON.stringify({ r: ['c'], w: ['d'] });
    const result = await execFunctional(commutativityProviderHandler, 'check', { readWriteSetsA: rwA, readWriteSetsB: rwB }, storage);
    expect(result.variant).toBe('ok');
    expect(result.commutes).toBe(true);
    const stored = await storage.get('results', result.result as string);
    expect(stored).not.toBeNull();
    expect(stored!.commutes).toBe(true);
  });

  it('check returns commutes=false for write-write conflict', async () => {
    const rwA = JSON.stringify({ r: [], w: ['x'] });
    const rwB = JSON.stringify({ r: [], w: ['x'] });
    const result = await execFunctional(commutativityProviderHandler, 'check', { readWriteSetsA: rwA, readWriteSetsB: rwB }, storage);
    expect(result.commutes).toBe(false);
  });
});

describe('DeadBranchProvider — Interpreted Execution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('analyze stores result and returns dead branch info', async () => {
    const program = JSON.stringify({
      instructions: [{ tag: 'branch', condition: 'true', thenBranch: 't', elseBranch: 'e' }],
    });
    const result = await execFunctional(deadBranchProviderHandler, 'analyze', { program, constraints: '{}' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.totalCount).toBe(2);
    expect(result.reachableCount).toBe(1);
    const stored = await storage.get('results', result.result as string);
    expect(stored).not.toBeNull();
  });

  it('analyze with no branches returns zero counts', async () => {
    const result = await execFunctional(deadBranchProviderHandler, 'analyze', { program: JSON.stringify({ instructions: [] }), constraints: '{}' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.totalCount).toBe(0);
  });
});

describe('InvariantExtractionProvider — Interpreted Execution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('extract stores result and returns postconditions', async () => {
    const program = JSON.stringify({
      instructions: [{ tag: 'put', relation: 'users', key: 'u1', value: 'data' }],
    });
    const result = await execFunctional(invariantExtractionProviderHandler, 'extract', { program, conceptSpec: 'UserSpec' }, storage);
    expect(result.variant).toBe('ok');
    const properties = JSON.parse(result.properties as string);
    expect(properties).toHaveLength(1);
    expect(properties[0]).toContain('postcondition');

    const stored = await storage.get('results', result.result as string);
    expect(stored).not.toBeNull();
    expect(stored!.conceptRef).toBe('UserSpec');
  });

  it('extract with empty program returns empty properties', async () => {
    const result = await execFunctional(invariantExtractionProviderHandler, 'extract', { program: JSON.stringify({ instructions: [] }), conceptSpec: '' }, storage);
    expect(result.variant).toBe('ok');
    const properties = JSON.parse(result.properties as string);
    expect(properties).toHaveLength(0);
  });

  it('extract with frame conditions through interpreter', async () => {
    const program = JSON.stringify({
      instructions: [
        { tag: 'get', relation: 'config', key: 'c1', bindAs: 'cfg' },
        { tag: 'put', relation: 'users', key: 'u1', value: 'data' },
      ],
    });
    const result = await execFunctional(invariantExtractionProviderHandler, 'extract', { program, conceptSpec: 'AppSpec' }, storage);
    expect(result.variant).toBe('ok');
    const properties = JSON.parse(result.properties as string);
    const frameProps = properties.filter((p: string) => p.startsWith('frame:'));
    expect(frameProps).toHaveLength(1);
    expect(frameProps[0]).toContain('config');
  });
});
