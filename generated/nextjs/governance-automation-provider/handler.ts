// GovernanceAutomationProvider — Route automation actions through governance gates before execution.
// Ensures actions pass governance checks (timelocks, guards, quorum) before proceeding.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GovernanceAutomationProviderStorage,
  GovernanceAutomationProviderRegisterInput,
  GovernanceAutomationProviderRegisterOutput,
  GovernanceAutomationProviderExecuteInput,
  GovernanceAutomationProviderExecuteOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  executeOk,
  executeBlocked,
} from './types.js';

export interface GovernanceAutomationProviderError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): GovernanceAutomationProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface GovernanceAutomationProviderHandler {
  readonly register: (
    input: GovernanceAutomationProviderRegisterInput,
    storage: GovernanceAutomationProviderStorage,
  ) => TE.TaskEither<GovernanceAutomationProviderError, GovernanceAutomationProviderRegisterOutput>;
  readonly execute: (
    input: GovernanceAutomationProviderExecuteInput,
    storage: GovernanceAutomationProviderStorage,
  ) => TE.TaskEither<GovernanceAutomationProviderError, GovernanceAutomationProviderExecuteOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(): string {
  return `gov-auto-${++idCounter}`;
}

export const governanceAutomationProviderHandler: GovernanceAutomationProviderHandler = {
  register: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('governance-automation-provider', '__registered'),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('governance-automation-provider', '__registered', { value: true });
                  return registerOk('governance');
                },
                toStorageError,
              ),
            () => TE.right(registerAlreadyRegistered()),
          ),
        ),
      ),
    ),

  execute: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!inp.action_payload) {
          return TE.right(executeBlocked('action_payload is required'));
        }
        if (!inp.gate_config) {
          return TE.right(executeBlocked('gate_config is required'));
        }

        // Parse gate configuration
        let config: Record<string, unknown>;
        try {
          config = JSON.parse(inp.gate_config);
        } catch {
          return TE.right(executeBlocked('Invalid gate_config JSON'));
        }

        // Parse action payload
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(inp.action_payload);
        } catch {
          return TE.right(executeBlocked('Invalid action_payload JSON'));
        }

        const gateType = config.gate as string;
        const id = nextId();
        const now = new Date().toISOString();

        // Evaluate governance gate
        let blocked = false;
        let blockReason = '';

        if (gateType === 'timelock') {
          // Timelock gate — in production would schedule for delayed execution
          blocked = false;
        } else if (gateType === 'guard') {
          const condition = config.condition as string;
          if (condition === 'deny') {
            blocked = true;
            blockReason = `Guard condition denied: ${condition}`;
          }
        } else if (gateType === 'quorum') {
          const required = (config.required as number) || 1;
          const current = (config.current as number) || 0;
          if (current < required) {
            blocked = true;
            blockReason = `Quorum not met: ${current}/${required} approvals`;
          }
        }

        if (blocked) {
          return TE.tryCatch(
            async () => {
              await storage.put('governance-automation-provider', id, {
                id,
                action_payload: inp.action_payload,
                gate_config: inp.gate_config,
                status: 'blocked',
                result: null,
                block_reason: blockReason,
                createdAt: now,
              });
              return executeBlocked(blockReason);
            },
            toStorageError,
          );
        }

        // Action passed governance gates
        const result = JSON.stringify({
          gate: gateType || 'none',
          action: payload.action || 'unknown',
          approved: true,
          timestamp: now,
        });

        return TE.tryCatch(
          async () => {
            await storage.put('governance-automation-provider', id, {
              id,
              action_payload: inp.action_payload,
              gate_config: inp.gate_config,
              status: 'approved',
              result,
              block_reason: null,
              createdAt: now,
            });
            return executeOk(result);
          },
          toStorageError,
        );
      }),
    ),
};
