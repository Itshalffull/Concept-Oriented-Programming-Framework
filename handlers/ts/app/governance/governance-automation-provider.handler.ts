// @clef-handler style=functional
// GovernanceAutomationProvider Concept Handler
// Routes automation actions through governance gates before execution.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, mapBindings, putFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _governanceAutomationProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'governance_automation_provider_registration', 'singleton', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'ok', { provider_name: 'governance' }),
      (b) => {
        let b2 = put(b, 'governance_automation_provider_registration', 'singleton', {
          provider_name: 'governance',
          registeredAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { provider_name: 'governance' });
      },
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionPayload = input.action_payload as string;
    const gateConfig = input.gate_config as string;

    if (!actionPayload || actionPayload.trim() === '') {
      return complete(createProgram(), 'error', { message: 'action_payload is required' }) as StorageProgram<Result>;
    }

    let parsedPayload: Record<string, unknown>;
    let parsedGate: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(actionPayload);
    } catch {
      return complete(createProgram(), 'error', { message: 'action_payload must be valid JSON' }) as StorageProgram<Result>;
    }
    try {
      parsedGate = JSON.parse(gateConfig || '{}');
    } catch {
      return complete(createProgram(), 'error', { message: 'gate_config must be valid JSON' }) as StorageProgram<Result>;
    }

    const gate = parsedGate.gate as string | undefined;
    const condition = parsedGate.condition as string | undefined;

    // Guard: deny condition blocks execution
    if (gate === 'guard' && condition === 'deny') {
      return complete(createProgram(), 'error', { reason: 'Action blocked by governance guard: condition evaluated to deny' }) as StorageProgram<Result>;
    }

    const id = `gov-exec-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'governance_automation_execution', id, {
      id,
      action_payload: actionPayload,
      gate_config: gateConfig,
      status: 'Completed',
      result: JSON.stringify({ action: parsedPayload.action, status: 'executed' }),
      executedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { result: JSON.stringify({ action: parsedPayload.action, status: 'executed', executionId: id }) }) as StorageProgram<Result>;
  },
};

export const governanceAutomationProviderHandler = autoInterpret(_governanceAutomationProviderHandler);
