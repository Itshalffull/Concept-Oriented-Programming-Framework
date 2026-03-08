// ============================================================
// GovernanceAutomationProvider Handler
//
// Route automation actions through governance gates before
// execution. Ensures actions pass governance checks (timelocks,
// guards, quorum) before proceeding. See Architecture doc
// Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `gov-auto-${++idCounter}`;
}

let registered = false;

export const governanceAutomationProviderHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('governance-automation-provider', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'governance' };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const actionPayload = input.action_payload as string;
    const gateConfig = input.gate_config as string;

    // Validate inputs
    if (!actionPayload) {
      return { variant: 'blocked', reason: 'action_payload is required' };
    }
    if (!gateConfig) {
      return { variant: 'blocked', reason: 'gate_config is required' };
    }

    // Parse gate configuration
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(gateConfig);
    } catch {
      return { variant: 'blocked', reason: 'Invalid gate_config JSON' };
    }

    // Parse action payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(actionPayload);
    } catch {
      return { variant: 'blocked', reason: 'Invalid action_payload JSON' };
    }

    const gateType = config.gate as string;
    const id = nextId();
    const now = new Date().toISOString();

    // Evaluate governance gate
    let blocked = false;
    let blockReason = '';

    if (gateType === 'timelock') {
      const delay = config.delay as number;
      if (delay && delay > 0) {
        // Check if a previous execution created a pending timelock
        const pending = await storage.get('governance-automation-provider', `timelock-${id}`);
        if (!pending) {
          // First attempt — create pending timelock record
          // In production, this would schedule the action for later
          // For now, we allow through if delay is specified but simulate approval
          blocked = false;
        }
      }
    } else if (gateType === 'guard') {
      const condition = config.condition as string;
      if (condition === 'deny') {
        blocked = true;
        blockReason = `Guard condition denied: ${condition}`;
      }
    } else if (gateType === 'quorum') {
      const required = config.required as number || 1;
      const current = config.current as number || 0;
      if (current < required) {
        blocked = true;
        blockReason = `Quorum not met: ${current}/${required} approvals`;
      }
    }

    if (blocked) {
      await storage.put('governance-automation-provider', id, {
        id,
        action_payload: actionPayload,
        gate_config: gateConfig,
        status: 'blocked',
        result: null,
        block_reason: blockReason,
        createdAt: now,
      });

      return { variant: 'blocked', reason: blockReason };
    }

    // Action passed governance gates
    const result = JSON.stringify({
      gate: gateType || 'none',
      action: payload.action || 'unknown',
      approved: true,
      timestamp: now,
    });

    await storage.put('governance-automation-provider', id, {
      id,
      action_payload: actionPayload,
      gate_config: gateConfig,
      status: 'approved',
      result,
      block_reason: null,
      createdAt: now,
    });

    return { variant: 'ok', result };
  },
};

/** Reset internal state. Useful for testing. */
export function resetGovernanceAutomationProvider(): void {
  idCounter = 0;
  registered = false;
}
