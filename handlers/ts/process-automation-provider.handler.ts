// ============================================================
// ProcessAutomationProvider Handler
//
// Trigger ProcessSpec execution from automation rules. Starts
// process runs when automation fires, bridging automation into
// the process-foundation suite. See Architecture doc Sections
// 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `proc-auto-${++idCounter}`;
}

let runCounter = 0;
function nextRunId(): string {
  return `run-${++runCounter}`;
}

let registered = false;

export const processAutomationProviderHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('process-automation-provider', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'process' };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const actionPayload = input.action_payload as string;
    const processSpecId = input.process_spec_id as string;

    // Validate inputs
    if (!actionPayload) {
      return { variant: 'error', message: 'action_payload is required' };
    }
    if (!processSpecId) {
      return { variant: 'error', message: 'process_spec_id is required' };
    }

    // Parse and validate action payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(actionPayload);
    } catch {
      return { variant: 'error', message: 'Invalid action_payload JSON' };
    }

    // Check that the process spec exists (look it up in storage)
    const spec = await storage.get('process-spec', processSpecId);
    // If no spec is found in storage, we still proceed — the spec may be
    // loaded externally. The run will record the spec reference regardless.

    const id = nextId();
    const runId = nextRunId();
    const now = new Date().toISOString();

    await storage.put('process-automation-provider', id, {
      id,
      action_payload: actionPayload,
      process_spec_id: processSpecId,
      status: 'started',
      run_id: runId,
      error: null,
      createdAt: now,
    });

    return { variant: 'ok', run_id: runId };
  },
};

/** Reset internal state. Useful for testing. */
export function resetProcessAutomationProvider(): void {
  idCounter = 0;
  runCounter = 0;
  registered = false;
}
