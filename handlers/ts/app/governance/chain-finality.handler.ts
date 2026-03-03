// ChainFinality Provider
// Tracks blockchain transaction confirmations against a required threshold.
import type { ConceptHandler } from '@clef/runtime';

export const chainFinalityHandler: ConceptHandler = {
  async track(input, storage) {
    const id = `chain-${Date.now()}`;
    const required = (input.requiredConfirmations as number) ?? 12;
    await storage.put('chain_final', id, {
      id,
      operationRef: input.operationRef,
      txHash: input.txHash,
      chainId: input.chainId,
      requiredConfirmations: required,
      status: 'Pending',
      submittedBlock: input.submittedBlock ?? 0,
    });

    await storage.put('plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'ChainFinality',
      instanceId: id,
    });

    return { variant: 'tracking', entry: id };
  },

  async checkFinality(input, storage) {
    const { entry, currentBlock } = input;
    const record = await storage.get('chain_final', entry as string);
    if (!record) return { variant: 'not_found', entry };

    const required = record.requiredConfirmations as number;
    const submittedBlock = record.submittedBlock as number;
    const current = (currentBlock as number) ?? submittedBlock;
    const confirmations = Math.max(0, current - submittedBlock);

    if (confirmations >= required) {
      await storage.put('chain_final', entry as string, { ...record, status: 'Finalized' });
      return { variant: 'finalized', entry, currentConfirmations: confirmations, required };
    }

    return { variant: 'pending', entry, currentConfirmations: confirmations, required };
  },
};
