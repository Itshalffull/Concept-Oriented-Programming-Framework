// PeerAllocation Reputation Provider
// Coordinape-style: peers allocate a budget to each other, normalized on finalize.
import type { ConceptHandler } from '@clef/runtime';

export const peerAllocationHandler: ConceptHandler = {
  async openRound(input, storage) {
    const id = `peer-alloc-${Date.now()}`;
    const deadline = new Date(Date.now() + (input.deadlineDays as number) * 86400000).toISOString();
    await storage.put('peer_alloc', id, {
      id,
      budget: input.budget as number,
      deadline,
      status: 'Open',
    });

    await storage.put('plugin-registry', `reputation-algorithm:${id}`, {
      id: `reputation-algorithm:${id}`,
      pluginKind: 'reputation-algorithm',
      provider: 'PeerAllocation',
      instanceId: id,
    });

    return { variant: 'opened', round: id };
  },

  async allocate(input, storage) {
    const { round, allocator, recipient, amount, note } = input;
    const record = await storage.get('peer_alloc', round as string);
    if (!record) return { variant: 'not_found', round };
    if (record.status !== 'Open') return { variant: 'round_closed', round };
    if (allocator === recipient) return { variant: 'self_allocation', allocator };

    const key = `${round}:${allocator}:${recipient}`;
    await storage.put('peer_alloc_entry', key, {
      round, allocator, recipient,
      amount: amount as number,
      note: note ?? null,
      allocatedAt: new Date().toISOString(),
    });

    // Check total allocated by this allocator
    const allByAllocator = await storage.find('peer_alloc_entry', { round: round as string, allocator: allocator as string });
    const totalAllocated = allByAllocator.reduce((s, e) => s + (e.amount as number), 0);

    return { variant: 'allocated', round, totalAllocated, budget: record.budget };
  },

  async finalize(input, storage) {
    const { round } = input;
    const record = await storage.get('peer_alloc', round as string);
    if (!record) return { variant: 'not_found', round };

    const allEntries = await storage.find('peer_alloc_entry', { round: round as string });

    // Aggregate per recipient
    const totals: Record<string, number> = {};
    for (const entry of allEntries) {
      const r = entry.recipient as string;
      totals[r] = (totals[r] ?? 0) + (entry.amount as number);
    }

    // Normalize to budget
    const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
    const budget = record.budget as number;
    const normalized: Record<string, number> = {};
    for (const [recipient, total] of Object.entries(totals)) {
      normalized[recipient] = grandTotal > 0 ? (total / grandTotal) * budget : 0;
    }

    await storage.put('peer_alloc', round as string, {
      ...record,
      status: 'Finalized',
      finalizedAt: new Date().toISOString(),
    });

    return { variant: 'finalized', round, results: JSON.stringify(normalized) };
  },
};
