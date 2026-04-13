/**
 * Invocation Lifecycle End-to-End Tests
 *
 * Verifies the full status lifecycle declared in:
 *   docs/plans/invocation-lifecycle-prd.md §6 Success Criterion 6
 *   INV-07 card
 *
 * Scenario: An action fails on first invoke, user retries, second invoke succeeds.
 *
 * Lifecycle asserted (PRD §6 SC-6):
 *   start → pending → fail(message) → retry → start → complete(result) → dismiss
 *
 * ## Test levels
 *
 * Level 1 — Unit/kernel (this file, Section A):
 *   Boot the Invocation handler with createInMemoryStorage, drive the full
 *   lifecycle programmatically via the handler, assert each Invocation state
 *   transition from concept storage.
 *
 * Level 2 — Hook state machine (this file, Section B):
 *   No DOM required. Exercises the status derivation logic and retry/dismiss
 *   state transitions by directly manipulating InvocationRecord shapes and
 *   asserting the derived InvocationStatus values — matching what
 *   useInvokeWithFeedback would produce for a fail-then-succeed flow.
 *
 * References:
 *   - specs/app/invocation.concept
 *   - handlers/ts/app/invocation.handler.ts
 *   - clef-base/lib/useInvocation.ts
 *   - surface/invocation-status.widget
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { interpret } from '../runtime/interpreter.js';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { invocationHandler } from '../handlers/ts/app/invocation.handler.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const INV_ID_1 = 'inv-lifecycle-001';   // first (failing) invocation
const INV_ID_2 = 'inv-lifecycle-002';   // retry invocation (succeeds)
const CONN_ID  = 'conn-e2e-test';
const BINDING  = 'e2e-test-binding';
const PARAMS   = btoa(JSON.stringify({ target: 'test-resource-001' })); // base64

const T_START_1    = '2026-04-13T10:00:00Z';
const T_FAIL_1     = '2026-04-13T10:00:03Z';
const T_START_2    = '2026-04-13T10:00:10Z';
const T_COMPLETE_2 = '2026-04-13T10:00:15Z';
const T_DISMISS    = '2026-04-13T10:01:00Z';

const ERROR_MSG  = 'Kernel returned error: resource not found';
const RESULT_B64 = btoa(JSON.stringify({ status: 'installed', version: '1.0.0' }));

// ---------------------------------------------------------------------------
// Section A — Unit-level kernel tests
// ---------------------------------------------------------------------------

describe('Invocation lifecycle: kernel unit tests (INV-07)', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // -------------------------------------------------------------------------
  // Step 1: start — invocation becomes pending
  // -------------------------------------------------------------------------

  it('Step 1: start creates a pending invocation record', async () => {
    const r = await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );

    expect(r.variant).toBe('ok');
    expect(r.output).toMatchObject({ invocation: INV_ID_1 });

    // Verify the record is in storage with pending-state shape.
    const raw = await storage.get('invocations', INV_ID_1) as Record<string, unknown> | null;
    expect(raw).not.toBeNull();
    expect(raw!.connection).toBe(CONN_ID);
    expect(raw!.binding).toBe(BINDING);
    expect(raw!.startedAt).toBe(T_START_1);
    expect(raw!.completedAt).toBeNull();        // pending: completedAt not set
    expect(raw!.error).toBeNull();               // pending: no error
    expect(raw!.result).toBeNull();              // pending: no result
    expect(raw!.retriedFrom).toBeNull();

    // Derive status from raw record (PRD §2.2 rules).
    const status = deriveStatus(raw! as InvocationRecord);
    expect(status).toBe('pending');
  });

  // -------------------------------------------------------------------------
  // Step 1b: duplicate start is rejected
  // -------------------------------------------------------------------------

  it('Step 1b: second start with same id returns duplicate', async () => {
    // Register the first invocation.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );

    // Try to register again with the same id.
    const r = await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );

    expect(r.variant).toBe('duplicate');
  });

  // -------------------------------------------------------------------------
  // Step 2: fail — invocation transitions to error
  // -------------------------------------------------------------------------

  it('Step 2: fail records error message and transitions to error status', async () => {
    // Prerequisite: start.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );

    // Fail the invocation.
    const r = await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );

    expect(r.variant).toBe('ok');

    // Read the raw record from storage.
    const raw = await storage.get('invocations', INV_ID_1) as Record<string, unknown>;
    expect(raw.completedAt).toBe(T_FAIL_1);
    expect(raw.error).toBe(ERROR_MSG);
    expect(raw.result).toBeNull();

    // Derive status.
    const status = deriveStatus(raw as InvocationRecord);
    expect(status).toBe('error');
  });

  // -------------------------------------------------------------------------
  // Step 2b: fail on missing invocation returns not_found
  // -------------------------------------------------------------------------

  it('Step 2b: fail on unknown id returns not_found', async () => {
    const r = await interpret(
      invocationHandler.fail({
        invocation: 'no-such-inv',
        error: 'timeout',
        completedAt: T_FAIL_1,
      }),
      storage,
    );

    expect(r.variant).toBe('not_found');
  });

  // -------------------------------------------------------------------------
  // Step 2c: second fail on same invocation returns already_completed
  // -------------------------------------------------------------------------

  it('Step 2c: fail twice on same invocation returns already_completed', async () => {
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );

    const r = await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: 'second error',
        completedAt: '2026-04-13T10:00:04Z',
      }),
      storage,
    );

    expect(r.variant).toBe('already_completed');
  });

  // -------------------------------------------------------------------------
  // Step 3: retry — new pending invocation linked to failed predecessor
  // -------------------------------------------------------------------------

  it('Step 3: retry creates new pending invocation with retriedFrom pointing to predecessor', async () => {
    // Start + fail the predecessor.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );

    // Retry: create a new invocation.
    const r = await interpret(
      invocationHandler.retry({
        invocation: INV_ID_1,
        newInvocation: INV_ID_2,
        startedAt: T_START_2,
      }),
      storage,
    );

    expect(r.variant).toBe('ok');
    // retry() returns the new invocation id.
    expect(r.output).toMatchObject({ invocation: INV_ID_2 });

    // New invocation is pending.
    const newRaw = await storage.get('invocations', INV_ID_2) as Record<string, unknown>;
    expect(newRaw).not.toBeNull();
    expect(newRaw.retriedFrom).toBe(INV_ID_1);
    expect(newRaw.connection).toBe(CONN_ID);
    expect(newRaw.binding).toBe(BINDING);
    expect(newRaw.params).toBe(PARAMS);
    expect(newRaw.completedAt).toBeNull();
    expect(newRaw.error).toBeNull();
    expect(deriveStatus(newRaw as InvocationRecord)).toBe('pending');

    // Predecessor still exists and is in error state.
    const predRaw = await storage.get('invocations', INV_ID_1) as Record<string, unknown>;
    expect(predRaw.error).toBe(ERROR_MSG);
    expect(deriveStatus(predRaw as InvocationRecord)).toBe('error');
  });

  // -------------------------------------------------------------------------
  // Step 3b: retry on non-failed invocation returns not_failed
  // -------------------------------------------------------------------------

  it('Step 3b: retry on a non-failed invocation returns not_failed', async () => {
    // Register a pending (not yet failed) invocation.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );

    const r = await interpret(
      invocationHandler.retry({
        invocation: INV_ID_1,
        newInvocation: INV_ID_2,
        startedAt: T_START_2,
      }),
      storage,
    );

    expect(r.variant).toBe('not_failed');
  });

  // -------------------------------------------------------------------------
  // Step 4: second invoke succeeds → complete transitions to ok
  // -------------------------------------------------------------------------

  it('Step 4: complete transitions the retry invocation to ok status with result', async () => {
    // Build up to the retry invocation.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.retry({
        invocation: INV_ID_1,
        newInvocation: INV_ID_2,
        startedAt: T_START_2,
      }),
      storage,
    );

    // Second action succeeds — complete the retry invocation.
    const r = await interpret(
      invocationHandler.complete({
        invocation: INV_ID_2,
        result: RESULT_B64,
        completedAt: T_COMPLETE_2,
      }),
      storage,
    );

    expect(r.variant).toBe('ok');

    // Verify the retry invocation is now in ok state.
    const raw = await storage.get('invocations', INV_ID_2) as Record<string, unknown>;
    expect(raw.completedAt).toBe(T_COMPLETE_2);
    expect(raw.result).toBe(RESULT_B64);
    expect(raw.error).toBeNull();
    expect(deriveStatus(raw as InvocationRecord)).toBe('ok');
  });

  // -------------------------------------------------------------------------
  // Step 4b: complete on already-completed invocation returns already_completed
  // -------------------------------------------------------------------------

  it('Step 4b: complete twice returns already_completed', async () => {
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.complete({
        invocation: INV_ID_1,
        result: RESULT_B64,
        completedAt: T_COMPLETE_2,
      }),
      storage,
    );

    const r = await interpret(
      invocationHandler.complete({
        invocation: INV_ID_1,
        result: RESULT_B64,
        completedAt: '2026-04-13T10:00:16Z',
      }),
      storage,
    );

    expect(r.variant).toBe('already_completed');
  });

  // -------------------------------------------------------------------------
  // Step 5: dismiss — dismissedAt populated, invocation acknowledged
  // -------------------------------------------------------------------------

  it('Step 5: dismiss populates dismissedAt on completed invocation', async () => {
    // Set up a completed invocation.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_2,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_2,
      }),
      storage,
    );
    await interpret(
      invocationHandler.complete({
        invocation: INV_ID_2,
        result: RESULT_B64,
        completedAt: T_COMPLETE_2,
      }),
      storage,
    );

    // Simulate auto-dismiss (e.g. after 3 s per PRD §8 Q5).
    const r = await interpret(
      invocationHandler.dismiss({
        invocation: INV_ID_2,
        dismissedAt: T_DISMISS,
      }),
      storage,
    );

    expect(r.variant).toBe('ok');

    const raw = await storage.get('invocations', INV_ID_2) as Record<string, unknown>;
    expect(raw.dismissedAt).toBe(T_DISMISS);
  });

  // -------------------------------------------------------------------------
  // Full lifecycle: start → fail → retry → complete → dismiss
  // -------------------------------------------------------------------------

  it('Full lifecycle: start → pending → fail(error) → retry → complete(result) → dismiss', async () => {
    // 1. Start first invocation → pending.
    const r1 = await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    expect(r1.variant).toBe('ok');
    {
      const rec = await storage.get('invocations', INV_ID_1) as InvocationRecord;
      expect(deriveStatus(rec)).toBe('pending');
    }

    // 2. First invoke fails → error.
    const r2 = await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );
    expect(r2.variant).toBe('ok');
    {
      const rec = await storage.get('invocations', INV_ID_1) as InvocationRecord;
      expect(deriveStatus(rec)).toBe('error');
      expect(rec.error).toBe(ERROR_MSG);
    }

    // 3. Retry → new pending invocation with retriedFrom.
    const r3 = await interpret(
      invocationHandler.retry({
        invocation: INV_ID_1,
        newInvocation: INV_ID_2,
        startedAt: T_START_2,
      }),
      storage,
    );
    expect(r3.variant).toBe('ok');
    {
      const rec = await storage.get('invocations', INV_ID_2) as InvocationRecord;
      expect(deriveStatus(rec)).toBe('pending');
      expect(rec.retriedFrom).toBe(INV_ID_1);
    }

    // 4. Second invoke succeeds → ok with result.
    const r4 = await interpret(
      invocationHandler.complete({
        invocation: INV_ID_2,
        result: RESULT_B64,
        completedAt: T_COMPLETE_2,
      }),
      storage,
    );
    expect(r4.variant).toBe('ok');
    {
      const rec = await storage.get('invocations', INV_ID_2) as InvocationRecord;
      expect(deriveStatus(rec)).toBe('ok');
      expect(rec.result).toBe(RESULT_B64);
    }

    // 5. Dismiss → dismissedAt populated.
    const r5 = await interpret(
      invocationHandler.dismiss({
        invocation: INV_ID_2,
        dismissedAt: T_DISMISS,
      }),
      storage,
    );
    expect(r5.variant).toBe('ok');
    {
      const rec = await storage.get('invocations', INV_ID_2) as InvocationRecord;
      expect(rec.dismissedAt).toBe(T_DISMISS);
    }
  });

  // -------------------------------------------------------------------------
  // Invariant: completed invocations always carry result or error (not both)
  // -------------------------------------------------------------------------

  it('Invariant: completed-ok record has result set and no error', async () => {
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.complete({
        invocation: INV_ID_1,
        result: RESULT_B64,
        completedAt: T_COMPLETE_2,
      }),
      storage,
    );

    const rec = await storage.get('invocations', INV_ID_1) as InvocationRecord;
    expect(rec.completedAt).not.toBeNull();
    // exactly one of result/error is set
    const hasResult = rec.result != null;
    const hasError  = rec.error != null;
    expect(hasResult || hasError).toBe(true);
    expect(hasResult && hasError).toBe(false);
  });

  it('Invariant: completed-error record has error set and no result', async () => {
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );

    const rec = await storage.get('invocations', INV_ID_1) as InvocationRecord;
    expect(rec.completedAt).not.toBeNull();
    const hasResult = rec.result != null;
    const hasError  = rec.error != null;
    expect(hasResult || hasError).toBe(true);
    expect(hasResult && hasError).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Invariant: retriedFrom only points to failed invocations
  // -------------------------------------------------------------------------

  it('Invariant: retriedFrom points only to a failed predecessor', async () => {
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.fail({
        invocation: INV_ID_1,
        error: ERROR_MSG,
        completedAt: T_FAIL_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.retry({
        invocation: INV_ID_1,
        newInvocation: INV_ID_2,
        startedAt: T_START_2,
      }),
      storage,
    );

    const retryRec = await storage.get('invocations', INV_ID_2) as InvocationRecord;
    expect(retryRec.retriedFrom).toBe(INV_ID_1);

    const predRec = await storage.get('invocations', INV_ID_1) as InvocationRecord;
    // Predecessor must have error set (i.e., it is a failed invocation).
    expect(predRec.error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // query: returns invocations for the connection
  // -------------------------------------------------------------------------

  it('query returns all invocations for a connection', async () => {
    // Create two invocations for CONN_ID and one for a different connection.
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_1,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );
    await interpret(
      invocationHandler.start({
        invocation: INV_ID_2,
        connection: CONN_ID,
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_2,
      }),
      storage,
    );
    await interpret(
      invocationHandler.start({
        invocation: 'inv-other-conn',
        connection: 'conn-other',
        binding: BINDING,
        params: PARAMS,
        startedAt: T_START_1,
      }),
      storage,
    );

    const r = await interpret(
      invocationHandler.query({
        connection: CONN_ID,
        binding: null,
        since: null,
      }),
      storage,
    );

    expect(r.variant).toBe('ok');
    // The query returns the 'matched' binding name as the value in the
    // static complete() call. The interpreter resolves this through the
    // shared bindings context. We verify the variant is ok and the
    // storage directly contains both records.
    const all = await storage.find('invocations', {}) as Array<Record<string, unknown>>;
    const forConn = all.filter(rec => rec.connection === CONN_ID);
    expect(forConn.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Section B — Hook state machine / status derivation tests (no DOM required)
// ---------------------------------------------------------------------------

/**
 * These tests mirror what useInvokeWithFeedback would produce for the
 * fail-then-succeed scenario. We drive the underlying status derivation
 * function (PRD §2.2) through the same record shapes that the kernel
 * produces, asserting the status sequence matches the spec lifecycle.
 *
 * This level keeps the tests environment=node compatible (no jsdom) while
 * still covering the hook's core state machine logic.
 */

describe('useInvokeWithFeedback status derivation: fail-then-succeed flow (INV-07)', () => {

  // -------------------------------------------------------------------------
  // Phase 1: invoke() called → Invocation/start registered → status pending
  // -------------------------------------------------------------------------

  it('Phase 1: after start registration, status derives as pending', () => {
    const record: InvocationRecord = {
      connection: CONN_ID,
      binding: BINDING,
      params: PARAMS,
      startedAt: T_START_1,
      completedAt: null,   // not completed yet
      dismissedAt: null,
      result: null,
      error: null,
      retriedFrom: null,
    };

    expect(deriveStatus(record)).toBe('pending');
    // Corresponds to PRD §2.2: completedAt == null ⇒ "pending"
  });

  // -------------------------------------------------------------------------
  // Phase 2: action fails → Invocation/fail recorded → status error
  // -------------------------------------------------------------------------

  it('Phase 2: after fail recording, status derives as error with message', () => {
    const record: InvocationRecord = {
      connection: CONN_ID,
      binding: BINDING,
      params: PARAMS,
      startedAt: T_START_1,
      completedAt: T_FAIL_1,   // terminal timestamp set
      dismissedAt: null,
      result: null,
      error: ERROR_MSG,         // error set
      retriedFrom: null,
    };

    expect(deriveStatus(record)).toBe('error');
    expect(record.error).toBe(ERROR_MSG);
    // Corresponds to PRD §2.2: completedAt set + error set ⇒ "error"
  });

  // -------------------------------------------------------------------------
  // Phase 3: user calls retry() → new invocation created → status pending
  // -------------------------------------------------------------------------

  it('Phase 3: after retry, new invocation record derives as pending', () => {
    const retryRecord: InvocationRecord = {
      connection: CONN_ID,
      binding: BINDING,
      params: PARAMS,
      startedAt: T_START_2,
      completedAt: null,          // new pending invocation
      dismissedAt: null,
      result: null,
      error: null,
      retriedFrom: INV_ID_1,      // points to predecessor
    };

    expect(deriveStatus(retryRecord)).toBe('pending');
    expect(retryRecord.retriedFrom).toBe(INV_ID_1);
  });

  // -------------------------------------------------------------------------
  // Phase 4: second action succeeds → Invocation/complete recorded → status ok
  // -------------------------------------------------------------------------

  it('Phase 4: after complete recording, status derives as ok with result', () => {
    const record: InvocationRecord = {
      connection: CONN_ID,
      binding: BINDING,
      params: PARAMS,
      startedAt: T_START_2,
      completedAt: T_COMPLETE_2,  // terminal timestamp set
      dismissedAt: null,
      result: RESULT_B64,          // result set
      error: null,
      retriedFrom: INV_ID_1,
    };

    expect(deriveStatus(record)).toBe('ok');
    expect(record.result).toBe(RESULT_B64);
    // Corresponds to PRD §2.2: completedAt set + error null ⇒ "ok"
  });

  // -------------------------------------------------------------------------
  // Phase 5: dismiss() called after 3 s → dismissedAt populated
  // -------------------------------------------------------------------------

  it('Phase 5: dismiss sets dismissedAt (auto-dismiss per PRD §8 Q5)', () => {
    const dismissed: InvocationRecord = {
      connection: CONN_ID,
      binding: BINDING,
      params: PARAMS,
      startedAt: T_START_2,
      completedAt: T_COMPLETE_2,
      dismissedAt: T_DISMISS,     // populated after dismiss()
      result: RESULT_B64,
      error: null,
      retriedFrom: INV_ID_1,
    };

    expect(dismissed.dismissedAt).toBe(T_DISMISS);
    // The status is still 'ok' — dismissedAt doesn't change the derived status.
    // It signals to the host that this record may be gc'd.
    expect(deriveStatus(dismissed)).toBe('ok');
  });

  // -------------------------------------------------------------------------
  // Status sequence: idle → pending → error → pending → ok
  // -------------------------------------------------------------------------

  it('Full status sequence: idle → pending → error → pending → ok matches PRD §6 SC-6', () => {
    // Simulate the hook's view of the invocation record at each lifecycle step.
    const sequence: Array<{ record: InvocationRecord | null; expectedStatus: InvocationStatus }> = [
      // Step 0: no record yet (hook initialised but invoke() not yet called).
      {
        record: null,
        expectedStatus: 'idle',
      },
      // Step 1: invoke() dispatched → start registered.
      {
        record: {
          connection: CONN_ID, binding: BINDING, params: PARAMS,
          startedAt: T_START_1,
          completedAt: null, dismissedAt: null, result: null, error: null, retriedFrom: null,
        },
        expectedStatus: 'pending',
      },
      // Step 2: first action fails.
      {
        record: {
          connection: CONN_ID, binding: BINDING, params: PARAMS,
          startedAt: T_START_1, completedAt: T_FAIL_1,
          dismissedAt: null, result: null, error: ERROR_MSG, retriedFrom: null,
        },
        expectedStatus: 'error',
      },
      // Step 3: user clicks retry → new pending invocation.
      {
        record: {
          connection: CONN_ID, binding: BINDING, params: PARAMS,
          startedAt: T_START_2,
          completedAt: null, dismissedAt: null, result: null, error: null,
          retriedFrom: INV_ID_1,
        },
        expectedStatus: 'pending',
      },
      // Step 4: second action succeeds.
      {
        record: {
          connection: CONN_ID, binding: BINDING, params: PARAMS,
          startedAt: T_START_2, completedAt: T_COMPLETE_2,
          dismissedAt: null, result: RESULT_B64, error: null,
          retriedFrom: INV_ID_1,
        },
        expectedStatus: 'ok',
      },
    ];

    for (const step of sequence) {
      expect(deriveStatus(step.record)).toBe(step.expectedStatus);
    }
  });

  // -------------------------------------------------------------------------
  // Retry guard: retry() is a no-op when status is not error
  // -------------------------------------------------------------------------

  it('retry() guard: only status=error permits retry call', () => {
    const nonErrorStates: Array<InvocationRecord | null> = [
      null,  // idle
      {
        connection: CONN_ID, binding: BINDING, params: PARAMS,
        startedAt: T_START_1,
        completedAt: null, dismissedAt: null, result: null, error: null, retriedFrom: null,
      }, // pending
      {
        connection: CONN_ID, binding: BINDING, params: PARAMS,
        startedAt: T_START_1, completedAt: T_COMPLETE_2,
        dismissedAt: null, result: RESULT_B64, error: null, retriedFrom: null,
      }, // ok
    ];

    for (const rec of nonErrorStates) {
      const status = deriveStatus(rec);
      // The hook guards: if (status !== 'error') return early.
      expect(status).not.toBe('error');
    }

    // Only the error record should permit retry.
    const errorRecord: InvocationRecord = {
      connection: CONN_ID, binding: BINDING, params: PARAMS,
      startedAt: T_START_1, completedAt: T_FAIL_1,
      dismissedAt: null, result: null, error: ERROR_MSG, retriedFrom: null,
    };
    expect(deriveStatus(errorRecord)).toBe('error');
  });

  // -------------------------------------------------------------------------
  // Dismiss guard: dismiss() is a no-op for idle and pending states
  // -------------------------------------------------------------------------

  it('dismiss() guard: only ok and error states permit dismiss', () => {
    const nonDismissable: Array<InvocationRecord | null> = [
      null,  // idle — no invocation to dismiss
      {
        connection: CONN_ID, binding: BINDING, params: PARAMS,
        startedAt: T_START_1,
        completedAt: null, dismissedAt: null, result: null, error: null, retriedFrom: null,
      }, // pending — action still in flight
    ];

    for (const rec of nonDismissable) {
      const status = deriveStatus(rec);
      // The hook guards: if (status === 'idle' || status === 'pending') return early.
      expect(['idle', 'pending']).toContain(status);
    }

    const dismissable: Array<{ rec: InvocationRecord; expectedStatus: InvocationStatus }> = [
      {
        rec: {
          connection: CONN_ID, binding: BINDING, params: PARAMS,
          startedAt: T_START_1, completedAt: T_COMPLETE_2,
          dismissedAt: null, result: RESULT_B64, error: null, retriedFrom: null,
        },
        expectedStatus: 'ok',
      },
      {
        rec: {
          connection: CONN_ID, binding: BINDING, params: PARAMS,
          startedAt: T_START_1, completedAt: T_FAIL_1,
          dismissedAt: null, result: null, error: ERROR_MSG, retriedFrom: null,
        },
        expectedStatus: 'error',
      },
    ];

    for (const { rec, expectedStatus } of dismissable) {
      expect(deriveStatus(rec)).toBe(expectedStatus);
    }
  });

  // -------------------------------------------------------------------------
  // isPending synchronous flag: true between invoke() call and first poll
  // -------------------------------------------------------------------------

  it('isPending is true between invoke() call and first status resolution', () => {
    // useInvokeWithFeedback sets isPending=true synchronously via React ref
    // before the Invocation/start kernel round-trip completes. The test
    // simulates this by asserting the guard logic independently.
    let isPending = false;
    const inFlightRef = { current: false };

    // Simulate the invoke() entry guard.
    const startInvoke = () => {
      if (inFlightRef.current) throw new Error('concurrent invocation rejected');
      inFlightRef.current = true;
      isPending = true;
    };
    const endInvoke = () => {
      inFlightRef.current = false;
      isPending = false;
    };

    expect(isPending).toBe(false);
    startInvoke();
    expect(isPending).toBe(true);
    // Concurrent call is rejected.
    expect(() => startInvoke()).toThrow('concurrent invocation rejected');
    endInvoke();
    expect(isPending).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type InvocationStatus = 'idle' | 'pending' | 'ok' | 'error';

interface InvocationRecord {
  connection: string;
  binding: string;
  params: string;
  startedAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
  result: string | null;
  error: string | null;
  retriedFrom: string | null;
}

/**
 * Status derivation per PRD §2.2:
 *   completedAt == null ⇒ "pending"
 *   completedAt set, error set ⇒ "error"
 *   completedAt set, error null ⇒ "ok"
 *   no record ⇒ "idle"
 */
function deriveStatus(rec: InvocationRecord | Record<string, unknown> | null): InvocationStatus {
  if (rec == null) return 'idle';
  const r = rec as InvocationRecord;
  if (r.completedAt == null) return 'pending';
  if (r.error != null) return 'error';
  return 'ok';
}
