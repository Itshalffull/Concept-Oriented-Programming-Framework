// @migrated dsl-constructs 2026-03-18
// ============================================================
// GovernanceAutomationProvider Handler
//
// Route automation actions through governance gates before
// execution. See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string { return `gov-auto-${++idCounter}`; }

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'governance-automation-provider', '__registered', { value: true });
    return complete(p, 'ok', { provider_name: 'governance' }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionPayload = input.action_payload as string;
    const gateConfig = input.gate_config as string;

    if (!actionPayload) { const p = createProgram(); return complete(p, 'blocked', { reason: 'action_payload is required' }) as StorageProgram<Result>; }
    if (!gateConfig) { const p = createProgram(); return complete(p, 'blocked', { reason: 'gate_config is required' }) as StorageProgram<Result>; }

    let config: Record<string, unknown>;
    try { config = JSON.parse(gateConfig); } catch { const p = createProgram(); return complete(p, 'blocked', { reason: 'Invalid gate_config JSON' }) as StorageProgram<Result>; }

    let payload: Record<string, unknown>;
    try { payload = JSON.parse(actionPayload); } catch { const p = createProgram(); return complete(p, 'blocked', { reason: 'Invalid action_payload JSON' }) as StorageProgram<Result>; }

    const gateType = config.gate as string;
    const id = nextId();
    const now = new Date().toISOString();

    let blocked = false;
    let blockReason = '';

    if (gateType === 'guard') {
      const condition = config.condition as string;
      if (condition === 'deny') { blocked = true; blockReason = `Guard condition denied: ${condition}`; }
    } else if (gateType === 'quorum') {
      const required = config.required as number || 1;
      const current = config.current as number || 0;
      if (current < required) { blocked = true; blockReason = `Quorum not met: ${current}/${required} approvals`; }
    }

    if (blocked) {
      let p = createProgram();
      p = put(p, 'governance-automation-provider', id, { id, action_payload: actionPayload, gate_config: gateConfig, status: 'blocked', result: null, block_reason: blockReason, createdAt: now });
      return complete(p, 'blocked', { reason: blockReason }) as StorageProgram<Result>;
    }

    const result = JSON.stringify({ gate: gateType || 'none', action: payload.action || 'unknown', approved: true, timestamp: now });
    let p = createProgram();
    p = put(p, 'governance-automation-provider', id, { id, action_payload: actionPayload, gate_config: gateConfig, status: 'approved', result, block_reason: null, createdAt: now });
    return complete(p, 'ok', { result }) as StorageProgram<Result>;
  },
};

export const governanceAutomationProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetGovernanceAutomationProvider(): void { idCounter = 0; registered = false; }
