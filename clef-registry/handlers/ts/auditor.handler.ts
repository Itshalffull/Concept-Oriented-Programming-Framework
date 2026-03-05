import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { randomUUID } from 'crypto';

export const auditorHandler: ConceptHandler = {
  async audit(input: Record<string, unknown>, storage: ConceptStorage) {
    const lockfile_entries = (input.lockfile_entries as string[]) ?? [];

    const id = randomUUID();

    await storage.put('audits', id, {
      id,
      lockfile_entries,
      vulnerabilities: [],
      status: 'complete',
    });

    return { variant: 'ok', audit: id, vulnerabilities: [] };
  },
};
