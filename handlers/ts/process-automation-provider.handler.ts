// @migrated dsl-constructs 2026-03-18
// ============================================================
// ProcessAutomationProvider Handler
//
// Trigger ProcessSpec execution from automation rules. Starts
// process runs when automation fires, bridging automation into
// the process-foundation suite. See Architecture doc Sections
// 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `proc-auto-${++idCounter}`;
}

let runCounter = 0;
function nextRunId(): string {
  return `run-${++runCounter}`;
}

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'process-automation-provider', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'process' }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionPayload = input.action_payload as string;
    const processSpecId = input.process_spec_id as string;

    if (!actionPayload) {
      const p = createProgram();
      return complete(p, 'error', { message: 'action_payload is required' }) as StorageProgram<Result>;
    }
    if (!processSpecId) {
      const p = createProgram();
      return complete(p, 'error', { message: 'process_spec_id is required' }) as StorageProgram<Result>;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(actionPayload);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid action_payload JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'process-spec', processSpecId, 'spec');

    const id = nextId();
    const runId = nextRunId();
    const now = new Date().toISOString();

    p = put(p, 'process-automation-provider', id, {
      id,
      action_payload: actionPayload,
      process_spec_id: processSpecId,
      status: 'started',
      run_id: runId,
      error: null,
      createdAt: now,
    });

    return complete(p, 'ok', { run_id: runId }) as StorageProgram<Result>;
  },
};

export const processAutomationProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetProcessAutomationProvider(): void {
  idCounter = 0;
  runCounter = 0;
  registered = false;
}
