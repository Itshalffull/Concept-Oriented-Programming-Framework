// @migrated dsl-constructs 2026-03-18
// ChainFinality Provider
// Tracks blockchain transaction confirmations against a required threshold.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _chainFinalityHandler: FunctionalConceptHandler = {
  track(input: Record<string, unknown>) {
    const id = `chain-${Date.now()}`;
    const required = (input.requiredConfirmations as number) ?? 12;
    let p = createProgram();
    p = put(p, 'chain_final', id, {
      id,
      operationRef: input.operationRef,
      txHash: input.txHash,
      chainId: input.chainId,
      requiredConfirmations: required,
      status: 'Pending',
      submittedBlock: input.submittedBlock ?? 0,
    });

    p = put(p, 'plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'ChainFinality',
      instanceId: id,
    });

    return complete(p, 'tracking', { entry: id }) as StorageProgram<Result>;
  },

  checkFinality(input: Record<string, unknown>) {
    const { entry, currentBlock } = input;
    let p = createProgram();
    p = get(p, 'chain_final', entry as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return completeFrom(thenP, 'finality_check', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const required = record.requiredConfirmations as number;
          const submittedBlock = record.submittedBlock as number;
          const current = (currentBlock as number) ?? submittedBlock;
          const confirmations = Math.max(0, current - submittedBlock);

          if (confirmations >= required) {
            return { variant: 'finalized', entry, currentConfirmations: confirmations, required };
          }

          return { variant: 'pending', entry, currentConfirmations: confirmations, required };
        });
      },
      (elseP) => complete(elseP, 'not_found', { entry }),
    ) as StorageProgram<Result>;
  },
};

export const chainFinalityHandler = autoInterpret(_chainFinalityHandler);
