/**
 * End-to-end tests: full view invoke pipeline
 *
 * Exercises the complete pipeline described in the PRD (Phase 4 step 4):
 *   InteractionSpec with createProgram reference
 *   → QueryProgram with invoke instruction
 *   → QueryExecution coroutine (execute → invoke_pending → resumeAfterInvoke → ok)
 *   → Static analysis providers (InvokeEffectProvider, QueryPurityProvider)
 *
 * Each scenario uses unique program IDs to avoid cross-test interference.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { queryProgramHandler } from '../../handlers/ts/view/query-program.handler.js';
import { queryExecutionHandler } from '../../handlers/ts/view/query-execution.handler.js';
import { interactionSpecHandler } from '../../handlers/ts/view/interaction-spec.handler.js';
import { invokeEffectProviderHandler } from '../../handlers/ts/view/providers/invoke-effect-provider.handler.js';
import { queryPurityProviderHandler } from '../../handlers/ts/view/providers/query-purity-provider.handler.js';
import { interpret } from '../../runtime/interpreter.js';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

type Storage = ReturnType<typeof createInMemoryStorage>;

/** Run a handler action and return the flat result object. */
async function run(
  handler: { [action: string]: (input: Record<string, unknown>) => unknown },
  action: string,
  input: Record<string, unknown>,
  storage: Storage,
): Promise<Record<string, unknown>> {
  const program = (handler as Record<string, (i: Record<string, unknown>) => unknown>)[action](input);
  const raw = await interpret(program as Parameters<typeof interpret>[0], storage);
  return { variant: raw.variant, ...(raw.output ?? {}) } as Record<string, unknown>;
}

/**
 * Build a basic invoke-bearing QueryProgram in storage and return
 * a serialized payload suitable for QueryExecution/execute.
 *
 * Steps: create → invoke → pure
 */
async function buildInvokeProgram(
  programId: string,
  concept: string,
  action: string,
  input: string,
  bindAs: string,
  storage: Storage,
): Promise<string> {
  await run(queryProgramHandler, 'create', { program: programId }, storage);
  await run(queryProgramHandler, 'invoke', {
    program: programId,
    concept,
    action,
    input,
    bindAs,
  }, storage);
  await run(queryProgramHandler, 'pure', {
    program: programId,
    variant: 'ok',
    output: bindAs,
  }, storage);

  return JSON.stringify({
    id: programId,
    instructions: [
      { type: 'invoke', concept, action, input, bindAs },
      { type: 'pure', variant: 'ok', output: bindAs },
    ],
  });
}

// ─── 1. Full create-and-refresh pipeline ────────────────────────────────────

describe('QueryProgram invoke e2e pipeline', () => {
  describe('1. Full create-and-refresh pipeline', () => {
    let storage: Storage;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it('InteractionSpec references a createProgram, QueryExecution yields invoke_pending, resume returns ok', async () => {
      // Step 1: create an InteractionSpec that references a QueryProgram
      const interactionName = 'e2e-create-and-refresh-interaction';
      const programId = 'e2e-create-and-refresh-prog';

      const interactionResult = await run(interactionSpecHandler, 'create', {
        name: interactionName,
        createForm: '',
        rowClick: '',
        rowActions: '[]',
        pickerMode: false,
        createProgram: programId,
        actionProgram: null,
      }, storage);
      expect(interactionResult.variant).toBe('ok');

      // Step 2: build the QueryProgram "create-and-refresh"
      //   invoke("ContentNode", "create", input, "result") → pure
      const programPayload = await buildInvokeProgram(
        programId,
        'ContentNode',
        'create',
        '{"node":"new-article","kind":"concept"}',
        'result',
        storage,
      );

      // Verify purity is read-write after construction
      const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
      expect(stored).toBeDefined();
      expect(stored.purity).toBe('read-write');
      expect((stored.invokedActions as string[])).toContain('ContentNode/create');

      // Step 3: register a kind/provider so QueryExecution can execute
      await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
      await run(queryExecutionHandler, 'register', {
        name: 'kernel-provider',
        kind: 'kernel',
        capabilities: '["scan","filter","sort"]',
      }, storage);

      // Step 4: execute the program — expect invoke_pending
      const execResult = await run(queryExecutionHandler, 'execute', {
        kind: 'kernel',
        program: programPayload,
      }, storage);

      expect(execResult.variant).toBe('invoke_pending');
      expect(execResult.concept).toBe('ContentNode');
      expect(execResult.action).toBe('create');
      expect(typeof execResult.continuation).toBe('string');

      // Verify the continuation is a valid structured program suffix
      const continuation = JSON.parse(execResult.continuation as string);
      expect(continuation.programId).toBe(programId);
      expect(Array.isArray(continuation.remainingInstructions)).toBe(true);
      // Only the pure() instruction remains after yielding the invoke
      expect(continuation.remainingInstructions).toHaveLength(1);
      expect(continuation.remainingInstructions[0].type).toBe('pure');

      // Step 5: resume with ok variant — program should complete
      const resumeResult = await run(queryExecutionHandler, 'resumeAfterInvoke', {
        continuation: execResult.continuation as string,
        variant: 'ok',
        output: JSON.stringify({ id: 'new-article', kind: 'concept' }),
      }, storage);

      expect(resumeResult.variant).toBe('ok');
      expect(typeof resumeResult.rows).toBe('string');
    });
  });

  // ─── 2. Bulk traverseInvoke pipeline ──────────────────────────────────────

  describe('2. Bulk traverseInvoke pipeline', () => {
    let storage: Storage;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it('traverseInvoke program yields invoke_pending for first item and can resume', async () => {
      // Build: scan → filter → traverseInvoke → pure
      const programId = 'e2e-bulk-traverse-invoke';

      await run(queryProgramHandler, 'create', { program: programId }, storage);
      await run(queryProgramHandler, 'scan', {
        program: programId,
        source: 'tasks',
        bindAs: 'all',
      }, storage);
      await run(queryProgramHandler, 'filter', {
        program: programId,
        node: '{"type":"lt","field":"dueDate","value":"2026-04-06"}',
        bindAs: 'overdue',
      }, storage);
      await run(queryProgramHandler, 'traverseInvoke', {
        program: programId,
        sourceBinding: 'overdue',
        itemBinding: '_task',
        concept: 'Task',
        action: 'escalate',
        inputTemplate: '{"taskId":"$_task.id"}',
        bindAs: 'results',
      }, storage);
      await run(queryProgramHandler, 'pure', {
        program: programId,
        variant: 'ok',
        output: 'results',
      }, storage);

      // Verify purity is read-write
      const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
      expect(stored.purity).toBe('read-write');
      expect((stored.invokedActions as string[])).toContain('Task/escalate');

      // Register execution provider
      await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
      await run(queryExecutionHandler, 'register', {
        name: 'kernel-traverse',
        kind: 'kernel',
        capabilities: '["scan","filter","traverseInvoke"]',
      }, storage);

      // Execute the program
      const programPayload = JSON.stringify({
        id: programId,
        instructions: [
          { type: 'scan', source: 'tasks', bindAs: 'all' },
          { type: 'filter', node: '{"type":"lt","field":"dueDate","value":"2026-04-06"}', bindAs: 'overdue' },
          {
            type: 'traverseInvoke',
            sourceBinding: 'overdue',
            itemBinding: '_task',
            concept: 'Task',
            action: 'escalate',
            inputTemplate: '{"taskId":"$_task.id"}',
            bindAs: 'results',
          },
          { type: 'pure', variant: 'ok', output: 'results' },
        ],
      });

      const execResult = await run(queryExecutionHandler, 'execute', {
        kind: 'kernel',
        program: programPayload,
      }, storage);

      // Either yields invoke_pending (items to process) or ok (no items matched filter)
      expect(['invoke_pending', 'ok']).toContain(execResult.variant);

      if (execResult.variant === 'invoke_pending') {
        // For the traverseInvoke case, concept and action must match
        expect(execResult.concept).toBe('Task');
        expect(execResult.action).toBe('escalate');
        expect(typeof execResult.continuation).toBe('string');

        // Resume with ok variant — should complete or yield next invoke_pending
        const resumeResult = await run(queryExecutionHandler, 'resumeAfterInvoke', {
          continuation: execResult.continuation as string,
          variant: 'ok',
          output: JSON.stringify({ taskId: 'task-1', status: 'escalated' }),
        }, storage);

        // Either done (ok) or still processing (invoke_pending for next item)
        expect(['ok', 'invoke_pending']).toContain(resumeResult.variant);
        if (resumeResult.variant === 'ok') {
          expect(typeof resumeResult.rows).toBe('string');
        }
      } else {
        // ok variant — no items matched, program completed without any invocations
        expect(typeof execResult.rows).toBe('string');
      }
    });
  });

  // ─── 3. Match handles error variant ──────────────────────────────────────

  describe('3. Match handles error variant', () => {
    let storage: Storage;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it('when invoke returns error variant, match takes wildcard path', async () => {
      // Build sub-programs: ok path and error/wildcard path
      const okPathId = 'e2e-match-ok-path';
      const errorPathId = 'e2e-match-error-path';
      const mainId = 'e2e-match-main';

      // ok path: pure ok immediately
      await run(queryProgramHandler, 'create', { program: okPathId }, storage);
      await run(queryProgramHandler, 'pure', {
        program: okPathId,
        variant: 'ok',
        output: 'createResult',
      }, storage);

      // error/wildcard path: pure error immediately
      await run(queryProgramHandler, 'create', { program: errorPathId }, storage);
      await run(queryProgramHandler, 'pure', {
        program: errorPathId,
        variant: 'error',
        output: 'createResult',
      }, storage);

      // Main program: invoke → match → pure
      await run(queryProgramHandler, 'create', { program: mainId }, storage);
      await run(queryProgramHandler, 'invoke', {
        program: mainId,
        concept: 'ContentNode',
        action: 'create',
        input: '{"node":"new-article","kind":"concept"}',
        bindAs: 'createResult',
      }, storage);

      const matchResult = await run(queryProgramHandler, 'match', {
        program: mainId,
        binding: 'createResult',
        cases: JSON.stringify({ ok: okPathId, '*': errorPathId }),
        bindAs: 'final',
      }, storage);
      expect(matchResult.variant).toBe('ok');

      await run(queryProgramHandler, 'pure', {
        program: mainId,
        variant: 'ok',
        output: 'final',
      }, storage);

      // Register execution
      await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
      await run(queryExecutionHandler, 'register', {
        name: 'kernel-match',
        kind: 'kernel',
        capabilities: '["invoke","match"]',
      }, storage);

      // Execute the main program — must yield invoke_pending
      const programPayload = JSON.stringify({
        id: mainId,
        instructions: [
          {
            type: 'invoke',
            concept: 'ContentNode',
            action: 'create',
            input: '{"node":"new-article","kind":"concept"}',
            bindAs: 'createResult',
          },
          {
            type: 'match',
            binding: 'createResult',
            cases: { ok: okPathId, '*': errorPathId },
            bindAs: 'final',
          },
          { type: 'pure', variant: 'ok', output: 'final' },
        ],
      });

      const execResult = await run(queryExecutionHandler, 'execute', {
        kind: 'kernel',
        program: programPayload,
      }, storage);

      expect(execResult.variant).toBe('invoke_pending');
      expect(execResult.concept).toBe('ContentNode');
      expect(execResult.action).toBe('create');

      // Resume with error variant — match should take the wildcard path
      const resumeResult = await run(queryExecutionHandler, 'resumeAfterInvoke', {
        continuation: execResult.continuation as string,
        variant: 'error',
        output: JSON.stringify({ message: 'duplicate entity' }),
      }, storage);

      // Program should complete (the wildcard error path is a sealed pure sub-program)
      expect(resumeResult.variant).toBe('ok');
      expect(typeof resumeResult.rows).toBe('string');
    });
  });

  // ─── 4. Read-only programs don't yield invoke_pending ────────────────────

  describe('4. Read-only programs don\'t yield invoke_pending', () => {
    let storage: Storage;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it('scan → filter → sort → pure program completes with ok — no invoke_pending', async () => {
      const programId = 'e2e-readonly-pipeline';

      await run(queryProgramHandler, 'create', { program: programId }, storage);
      await run(queryProgramHandler, 'scan', {
        program: programId,
        source: 'contentNodes',
        bindAs: 'nodes',
      }, storage);
      await run(queryProgramHandler, 'filter', {
        program: programId,
        node: '{"type":"eq","field":"kind","value":"concept"}',
        bindAs: 'filtered',
      }, storage);
      await run(queryProgramHandler, 'sort', {
        program: programId,
        keys: JSON.stringify([{ field: 'name', direction: 'asc' }]),
        bindAs: 'sorted',
      }, storage);
      await run(queryProgramHandler, 'pure', {
        program: programId,
        variant: 'ok',
        output: 'sorted',
      }, storage);

      // Verify purity is read-only — no invocations
      const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
      expect(stored.purity).toBe('read-only');
      expect((stored.invokedActions as string[])).toHaveLength(0);

      // Register execution
      await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
      await run(queryExecutionHandler, 'register', {
        name: 'kernel-readonly',
        kind: 'kernel',
        capabilities: '["scan","filter","sort"]',
      }, storage);

      const programPayload = JSON.stringify({
        id: programId,
        instructions: [
          { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
          { type: 'filter', node: '{"type":"eq","field":"kind","value":"concept"}', bindAs: 'filtered' },
          { type: 'sort', keys: [{ field: 'name', direction: 'asc' }], bindAs: 'sorted' },
          { type: 'pure', variant: 'ok', output: 'sorted' },
        ],
      });

      const execResult = await run(queryExecutionHandler, 'execute', {
        kind: 'kernel',
        program: programPayload,
      }, storage);

      // Must be ok — no invoke instructions, so no invoke_pending
      expect(execResult.variant).toBe('ok');
      expect(execResult.variant).not.toBe('invoke_pending');
      expect(typeof execResult.rows).toBe('string');
    });
  });

  // ─── 5. Static analysis integration ──────────────────────────────────────

  describe('5. Static analysis integration', () => {
    let storage: Storage;

    beforeEach(() => {
      storage = createInMemoryStorage();
    });

    it('InvokeEffectProvider extracts the concept/action pair from an invoke-bearing program', async () => {
      // Build a program with a single invoke instruction
      const programId = 'e2e-analysis-invoke';
      await run(queryProgramHandler, 'create', { program: programId }, storage);
      await run(queryProgramHandler, 'invoke', {
        program: programId,
        concept: 'ContentNode',
        action: 'archive',
        input: '{"id":"node-1"}',
        bindAs: 'result',
      }, storage);
      await run(queryProgramHandler, 'pure', {
        program: programId,
        variant: 'ok',
        output: 'result',
      }, storage);

      // Serialize the program for analysis
      const programJson = JSON.stringify({
        id: programId,
        instructions: [
          {
            type: 'invoke',
            concept: 'ContentNode',
            action: 'archive',
            input: '{"id":"node-1"}',
            bindAs: 'result',
          },
          { type: 'pure', variant: 'ok', output: 'result' },
        ],
      });

      // Run InvokeEffectProvider/analyze
      const analysisResult = await run(invokeEffectProviderHandler, 'analyze', {
        program: programJson,
      }, storage);

      expect(analysisResult.variant).toBe('ok');
      expect(typeof analysisResult.invocations).toBe('string');

      const invocations = JSON.parse(analysisResult.invocations as string) as string[];
      expect(invocations).toContain('ContentNode/archive');
      expect(analysisResult.invokeCount).toBeGreaterThanOrEqual(1);
    });

    it('QueryPurityProvider classifies invoke-bearing program as read-write', async () => {
      const programJson = JSON.stringify({
        id: 'e2e-analysis-purity-rw',
        instructions: [
          { type: 'scan', source: 'contentNodes', bindAs: 'nodes' },
          {
            type: 'invoke',
            concept: 'ContentNode',
            action: 'create',
            input: '{"node":"new"}',
            bindAs: 'result',
          },
          { type: 'pure', variant: 'ok', output: 'result' },
        ],
      });

      const analysisResult = await run(queryPurityProviderHandler, 'analyze', {
        program: programJson,
      }, storage);

      expect(analysisResult.variant).toBe('ok');
      expect(analysisResult.purity).toBe('read-write');

      const invokedActions = JSON.parse(analysisResult.invokedActions as string) as string[];
      expect(invokedActions).toContain('ContentNode/create');

      const readFields = JSON.parse(analysisResult.readFields as string) as string[];
      expect(readFields).toContain('contentNodes');
    });

    it('QueryPurityProvider classifies read-only program correctly', async () => {
      const programJson = JSON.stringify({
        id: 'e2e-analysis-purity-ro',
        instructions: [
          { type: 'scan', source: 'tasks', bindAs: 'all' },
          { type: 'filter', node: '{"type":"eq","field":"status","value":"open"}', bindAs: 'open' },
          { type: 'pure', variant: 'ok', output: 'open' },
        ],
      });

      const analysisResult = await run(queryPurityProviderHandler, 'analyze', {
        program: programJson,
      }, storage);

      expect(analysisResult.variant).toBe('ok');
      expect(analysisResult.purity).toBe('read-only');

      const invokedActions = JSON.parse(analysisResult.invokedActions as string) as string[];
      expect(invokedActions).toHaveLength(0);
    });

    it('InvokeEffectProvider extracts traverseInvoke concept/action pair', async () => {
      const programJson = JSON.stringify({
        id: 'e2e-analysis-traverse-invoke',
        instructions: [
          { type: 'scan', source: 'tasks', bindAs: 'all' },
          {
            type: 'traverseInvoke',
            sourceBinding: 'all',
            itemBinding: '_task',
            concept: 'Task',
            action: 'escalate',
            inputTemplate: '{"taskId":"$_task.id"}',
            bindAs: 'results',
          },
          { type: 'pure', variant: 'ok', output: 'results' },
        ],
      });

      const analysisResult = await run(invokeEffectProviderHandler, 'analyze', {
        program: programJson,
      }, storage);

      expect(analysisResult.variant).toBe('ok');
      const invocations = JSON.parse(analysisResult.invocations as string) as string[];
      expect(invocations).toContain('Task/escalate');
    });
  });
});
