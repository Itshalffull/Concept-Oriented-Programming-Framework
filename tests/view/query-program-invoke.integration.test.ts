/**
 * Integration tests: QueryProgram invoke instruction pipeline
 *
 * Covers the full invoke → QueryExecution → coroutine pipeline described in
 * the PRD (Phase 2 step 5):
 *   - invoke appends instruction and promotes purity to read-write
 *   - match validates cases JSON and appends instruction
 *   - traverseInvoke tracks invoked actions
 *   - traverse requires a sealed body program
 *   - QueryExecution yields invoke_pending for invoke instructions
 *   - QueryExecution resumeAfterInvoke continues execution and returns ok
 *   - Purity classification: read-only vs read-write
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { queryProgramHandler } from '../../handlers/ts/view/query-program.handler.js';
import { queryExecutionHandler } from '../../handlers/ts/view/query-execution.handler.js';
import { interpret } from '../../runtime/interpreter.js';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';

// ─── helpers ───────────────────────────────────────────────────────────────────

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

// ─── 1. invoke appends instruction and promotes purity ────────────────────────

describe('QueryProgram invoke', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('appends invoke instruction, tracks invoked action, and promotes purity to read-write', async () => {
    const programId = 'invoke-purity-test-1';

    // Create the program
    const createResult = await run(queryProgramHandler, 'create', { program: programId }, storage);
    expect(createResult.variant).toBe('ok');

    // Add a scan instruction (read-only)
    const scanResult = await run(queryProgramHandler, 'scan', {
      program: programId,
      source: 'contentNodes',
      bindAs: 'nodes',
    }, storage);
    expect(scanResult.variant).toBe('ok');

    // Add an invoke instruction — should promote purity
    const invokeResult = await run(queryProgramHandler, 'invoke', {
      program: programId,
      concept: 'ContentNode',
      action: 'create',
      input: '{"name":"test"}',
      bindAs: 'createResult',
    }, storage);
    expect(invokeResult.variant).toBe('ok');

    // Read back the stored program record to verify state
    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    expect(stored).toBeDefined();

    // Instructions list should include both scan and invoke
    const instructions = stored.instructions as string[];
    expect(instructions).toHaveLength(2);
    const parsedInvoke = JSON.parse(instructions[1]);
    expect(parsedInvoke.type).toBe('invoke');
    expect(parsedInvoke.concept).toBe('ContentNode');
    expect(parsedInvoke.action).toBe('create');
    expect(parsedInvoke.bindAs).toBe('createResult');

    // invokedActions should contain the concept/action pair
    const invokedActions = stored.invokedActions as string[];
    expect(invokedActions).toContain('ContentNode/create');

    // purity must be read-write after an invoke
    expect(stored.purity).toBe('read-write');
  });

  it('returns notfound when program does not exist', async () => {
    const result = await run(queryProgramHandler, 'invoke', {
      program: 'nonexistent-invoke',
      concept: 'Foo',
      action: 'bar',
      input: '{}',
      bindAs: 'r',
    }, storage);
    expect(result.variant).toBe('notfound');
  });

  it('returns sealed when program is already terminated', async () => {
    const programId = 'sealed-invoke-test';
    await run(queryProgramHandler, 'create', { program: programId }, storage);
    await run(queryProgramHandler, 'pure', {
      program: programId,
      variant: 'ok',
      output: 'nodes',
    }, storage);

    const result = await run(queryProgramHandler, 'invoke', {
      program: programId,
      concept: 'Foo',
      action: 'bar',
      input: '{}',
      bindAs: 'r',
    }, storage);
    expect(result.variant).toBe('sealed');
  });
});

// ─── 2. match validates cases JSON ────────────────────────────────────────────

describe('QueryProgram match', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('returns invalid_cases when cases is not valid JSON', async () => {
    const programId = 'match-invalid-json';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    const result = await run(queryProgramHandler, 'match', {
      program: programId,
      binding: 'createResult',
      cases: 'not-valid-json',
      bindAs: 'outcome',
    }, storage);
    expect(result.variant).toBe('invalid_cases');
  });

  it('returns invalid_cases when cases is an empty object', async () => {
    const programId = 'match-empty-cases';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    const result = await run(queryProgramHandler, 'match', {
      program: programId,
      binding: 'createResult',
      cases: '{}',
      bindAs: 'outcome',
    }, storage);
    expect(result.variant).toBe('invalid_cases');
  });

  it('appends match instruction when cases JSON is valid and non-empty', async () => {
    const programId = 'match-valid-cases';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    const result = await run(queryProgramHandler, 'match', {
      program: programId,
      binding: 'createResult',
      cases: '{"ok":"prog-ok","*":"prog-err"}',
      bindAs: 'outcome',
    }, storage);
    expect(result.variant).toBe('ok');

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    const instructions = stored.instructions as string[];
    expect(instructions).toHaveLength(1);
    const parsed = JSON.parse(instructions[0]);
    expect(parsed.type).toBe('match');
    expect(parsed.binding).toBe('createResult');
    expect(parsed.bindAs).toBe('outcome');
  });
});

// ─── 3. traverseInvoke tracks invoked actions ─────────────────────────────────

describe('QueryProgram traverseInvoke', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('appends traverseInvoke instruction and records concept/action pair in invokedActions', async () => {
    const programId = 'traverse-invoke-track';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    // Add scan first so there's a source binding
    await run(queryProgramHandler, 'scan', {
      program: programId,
      source: 'tasks',
      bindAs: 'overdue',
    }, storage);

    const result = await run(queryProgramHandler, 'traverseInvoke', {
      program: programId,
      sourceBinding: 'overdue',
      itemBinding: '_task',
      concept: 'Task',
      action: 'escalate',
      inputTemplate: '{"taskId":"$_task.id"}',
      bindAs: 'results',
    }, storage);
    expect(result.variant).toBe('ok');

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    const invokedActions = stored.invokedActions as string[];
    expect(invokedActions).toContain('Task/escalate');

    // purity must be promoted to read-write
    expect(stored.purity).toBe('read-write');

    // bindings should record the output binding name
    const bindings = stored.bindings as string[];
    expect(bindings).toContain('results');
  });

  it('accumulates multiple invoked actions across invoke and traverseInvoke calls', async () => {
    const programId = 'multi-invoked-actions';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    await run(queryProgramHandler, 'invoke', {
      program: programId,
      concept: 'ContentNode',
      action: 'create',
      input: '{}',
      bindAs: 'r1',
    }, storage);

    await run(queryProgramHandler, 'traverseInvoke', {
      program: programId,
      sourceBinding: 'r1',
      itemBinding: '_item',
      concept: 'Tag',
      action: 'apply',
      inputTemplate: '{"tag":"$_item.id"}',
      bindAs: 'r2',
    }, storage);

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    const invokedActions = stored.invokedActions as string[];
    expect(invokedActions).toContain('ContentNode/create');
    expect(invokedActions).toContain('Tag/apply');
  });
});

// ─── 4. traverse requires sealed body ─────────────────────────────────────────

describe('QueryProgram traverse', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('returns not_sealed when body program has not been terminated with pure', async () => {
    const mainId = 'traverse-main-unsealed';
    const bodyId = 'traverse-body-unsealed';

    await run(queryProgramHandler, 'create', { program: mainId }, storage);
    await run(queryProgramHandler, 'create', { program: bodyId }, storage);
    // Body is not terminated — no pure() call

    const result = await run(queryProgramHandler, 'traverse', {
      program: mainId,
      sourceBinding: 'items',
      itemBinding: '_item',
      bodyProgram: bodyId,
      bindAs: 'outcomes',
      declaredEffects: '{}',
    }, storage);
    expect(result.variant).toBe('not_sealed');
  });

  it('appends traverse instruction when body program is sealed', async () => {
    const mainId = 'traverse-main-sealed';
    const bodyId = 'traverse-body-sealed';

    await run(queryProgramHandler, 'create', { program: mainId }, storage);
    await run(queryProgramHandler, 'create', { program: bodyId }, storage);

    // Seal the body program
    await run(queryProgramHandler, 'pure', {
      program: bodyId,
      variant: 'ok',
      output: 'r',
    }, storage);

    const result = await run(queryProgramHandler, 'traverse', {
      program: mainId,
      sourceBinding: 'items',
      itemBinding: '_item',
      bodyProgram: bodyId,
      bindAs: 'outcomes',
      declaredEffects: '{}',
    }, storage);
    expect(result.variant).toBe('ok');

    const stored = await storage.get('queryProgram', mainId) as Record<string, unknown>;
    const instructions = stored.instructions as string[];
    expect(instructions).toHaveLength(1);
    const parsed = JSON.parse(instructions[0]);
    expect(parsed.type).toBe('traverse');
    expect(parsed.bodyProgram).toBe(bodyId);
    expect(parsed.bindAs).toBe('outcomes');
  });

  it('inherits read-write purity from a body program that contains an invoke', async () => {
    const mainId = 'traverse-purity-inherit';
    const bodyId = 'traverse-body-invoke';

    await run(queryProgramHandler, 'create', { program: mainId }, storage);
    await run(queryProgramHandler, 'create', { program: bodyId }, storage);

    // Body contains an invoke — so body purity is read-write
    await run(queryProgramHandler, 'invoke', {
      program: bodyId,
      concept: 'Task',
      action: 'archive',
      input: '{"taskId":"$_item.id"}',
      bindAs: 'archiveResult',
    }, storage);
    await run(queryProgramHandler, 'pure', {
      program: bodyId,
      variant: 'ok',
      output: 'archiveResult',
    }, storage);

    // Main program scan + traverse
    await run(queryProgramHandler, 'scan', {
      program: mainId,
      source: 'tasks',
      bindAs: 'items',
    }, storage);

    const traverseResult = await run(queryProgramHandler, 'traverse', {
      program: mainId,
      sourceBinding: 'items',
      itemBinding: '_item',
      bodyProgram: bodyId,
      bindAs: 'outcomes',
      declaredEffects: '{"invokedActions":["Task/archive"],"completionVariants":["ok"]}',
    }, storage);
    expect(traverseResult.variant).toBe('ok');

    const stored = await storage.get('queryProgram', mainId) as Record<string, unknown>;
    expect(stored.purity).toBe('read-write');
    const invokedActions = stored.invokedActions as string[];
    expect(invokedActions).toContain('Task/archive');
  });
});

// ─── 5. QueryExecution yields invoke_pending for invoke instructions ──────────

describe('QueryExecution execute with invoke instruction', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('yields invoke_pending variant with concept, action, input, and continuation', async () => {
    // Register a kind and provider first
    await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
    await run(queryExecutionHandler, 'register', {
      name: 'kernel-provider',
      kind: 'kernel',
      capabilities: '["scan","filter","sort"]',
    }, storage);

    // Build a program with an invoke instruction
    const programPayload = {
      id: 'mark-read',
      instructions: [
        {
          type: 'invoke',
          concept: 'Notification',
          action: 'markRead',
          input: '{"id":"notif-42"}',
          bindAs: 'result',
        },
        { type: 'pure', variant: 'ok', output: 'result' },
      ],
    };

    const result = await run(queryExecutionHandler, 'execute', {
      kind: 'kernel',
      program: JSON.stringify(programPayload),
    }, storage);

    expect(result.variant).toBe('invoke_pending');
    expect(result.concept).toBe('Notification');
    expect(result.action).toBe('markRead');
    expect(result.input).toBe('{"id":"notif-42"}');

    // continuation should be valid JSON
    expect(typeof result.continuation).toBe('string');
    const continuation = JSON.parse(result.continuation as string);
    expect(continuation.programId).toBe('mark-read');
    expect(Array.isArray(continuation.remainingInstructions)).toBe(true);
    // remaining instructions = the pure() after the invoke
    expect(continuation.remainingInstructions).toHaveLength(1);
    expect(continuation.remainingInstructions[0].type).toBe('pure');
  });

  it('returns ok with empty rows for a program with no instructions', async () => {
    await run(queryExecutionHandler, 'registerKind', { kind: 'in-memory' }, storage);
    await run(queryExecutionHandler, 'register', {
      name: 'inmem-provider',
      kind: 'in-memory',
      capabilities: '["scan","filter"]',
    }, storage);

    const result = await run(queryExecutionHandler, 'execute', {
      kind: 'in-memory',
      program: JSON.stringify({ id: 'empty', instructions: [] }),
    }, storage);

    expect(result.variant).toBe('ok');
    expect(typeof result.rows).toBe('string');
  });
});

// ─── 6. QueryExecution resumeAfterInvoke continues execution ──────────────────

describe('QueryExecution resumeAfterInvoke', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('resumes from a continuation with invoke result and returns ok with rows', async () => {
    // Set up kind/provider
    await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
    await run(queryExecutionHandler, 'register', {
      name: 'kernel-provider',
      kind: 'kernel',
      capabilities: '["scan"]',
    }, storage);

    // Execute a program that yields invoke_pending
    const programPayload = {
      id: 'resume-test',
      instructions: [
        {
          type: 'invoke',
          concept: 'Notification',
          action: 'markRead',
          input: '{"id":"notif-99"}',
          bindAs: 'result',
        },
        { type: 'pure', variant: 'ok', output: 'result' },
      ],
    };

    const executeResult = await run(queryExecutionHandler, 'execute', {
      kind: 'kernel',
      program: JSON.stringify(programPayload),
    }, storage);
    expect(executeResult.variant).toBe('invoke_pending');

    // Simulate the invoke completing with ok variant
    const resumeResult = await run(queryExecutionHandler, 'resumeAfterInvoke', {
      continuation: executeResult.continuation as string,
      variant: 'ok',
      output: JSON.stringify({ id: 'notif-99', read: true }),
    }, storage);

    expect(resumeResult.variant).toBe('ok');
    expect(typeof resumeResult.rows).toBe('string');
  });

  it('returns error when continuation is invalid JSON', async () => {
    const result = await run(queryExecutionHandler, 'resumeAfterInvoke', {
      continuation: 'not-valid-json',
      variant: 'ok',
      output: '{}',
    }, storage);
    expect(result.variant).toBe('error');
    expect(typeof result.message).toBe('string');
  });

  it('returns error when continuation is empty', async () => {
    const result = await run(queryExecutionHandler, 'resumeAfterInvoke', {
      continuation: '',
      variant: 'ok',
      output: '{}',
    }, storage);
    expect(result.variant).toBe('error');
  });

  it('chains two invoke instructions via successive resumeAfterInvoke calls', async () => {
    await run(queryExecutionHandler, 'registerKind', { kind: 'kernel' }, storage);
    await run(queryExecutionHandler, 'register', {
      name: 'kernel-chain',
      kind: 'kernel',
      capabilities: '[]',
    }, storage);

    // Program with two sequential invokes
    const programPayload = {
      id: 'two-invoke-chain',
      instructions: [
        {
          type: 'invoke',
          concept: 'Task',
          action: 'lock',
          input: '{"id":"task-1"}',
          bindAs: 'lockResult',
        },
        {
          type: 'invoke',
          concept: 'Task',
          action: 'archive',
          input: '{"id":"task-1"}',
          bindAs: 'archiveResult',
        },
        { type: 'pure', variant: 'ok', output: 'archiveResult' },
      ],
    };

    // First execute → yields first invoke_pending
    const r1 = await run(queryExecutionHandler, 'execute', {
      kind: 'kernel',
      program: JSON.stringify(programPayload),
    }, storage);
    expect(r1.variant).toBe('invoke_pending');
    expect(r1.concept).toBe('Task');
    expect(r1.action).toBe('lock');

    // Resume first invoke → yields second invoke_pending
    const r2 = await run(queryExecutionHandler, 'resumeAfterInvoke', {
      continuation: r1.continuation as string,
      variant: 'ok',
      output: JSON.stringify({ locked: true }),
    }, storage);
    expect(r2.variant).toBe('invoke_pending');
    expect(r2.concept).toBe('Task');
    expect(r2.action).toBe('archive');

    // Resume second invoke → final ok with rows
    const r3 = await run(queryExecutionHandler, 'resumeAfterInvoke', {
      continuation: r2.continuation as string,
      variant: 'ok',
      output: JSON.stringify({ archived: true }),
    }, storage);
    expect(r3.variant).toBe('ok');
    expect(typeof r3.rows).toBe('string');
  });
});

// ─── 7. Purity classification: read-only vs read-write ────────────────────────

describe('Purity classification', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('program with only scan and filter has purity = read-only', async () => {
    const programId = 'purity-read-only';
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

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    expect(stored.purity).toBe('read-only');
    const invokedActions = stored.invokedActions as string[];
    expect(invokedActions).toHaveLength(0);
  });

  it('empty program (just created) has purity = pure', async () => {
    const programId = 'purity-pure-empty';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    expect(stored.purity).toBe('pure');
  });

  it('program with scan + invoke has purity = read-write', async () => {
    const programId = 'purity-read-write';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    await run(queryProgramHandler, 'scan', {
      program: programId,
      source: 'contentNodes',
      bindAs: 'nodes',
    }, storage);
    await run(queryProgramHandler, 'invoke', {
      program: programId,
      concept: 'ContentNode',
      action: 'create',
      input: '{"name":"test"}',
      bindAs: 'createResult',
    }, storage);

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    expect(stored.purity).toBe('read-write');
  });

  it('purity never decreases: read-write stays read-write after more reads', async () => {
    const programId = 'purity-monotone';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    // First: invoke (promotes to read-write)
    await run(queryProgramHandler, 'invoke', {
      program: programId,
      concept: 'Task',
      action: 'create',
      input: '{}',
      bindAs: 'r',
    }, storage);

    // Then: scan (read-only instruction, but purity should not decrease)
    await run(queryProgramHandler, 'scan', {
      program: programId,
      source: 'tasks',
      bindAs: 'all',
    }, storage);

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    expect(stored.purity).toBe('read-write');
  });

  it('program with traverseInvoke has purity = read-write', async () => {
    const programId = 'purity-traverse-invoke';
    await run(queryProgramHandler, 'create', { program: programId }, storage);

    await run(queryProgramHandler, 'traverseInvoke', {
      program: programId,
      sourceBinding: 'items',
      itemBinding: '_item',
      concept: 'Task',
      action: 'archive',
      inputTemplate: '{"id":"$_item.id"}',
      bindAs: 'results',
    }, storage);

    const stored = await storage.get('queryProgram', programId) as Record<string, unknown>;
    expect(stored.purity).toBe('read-write');
  });
});
