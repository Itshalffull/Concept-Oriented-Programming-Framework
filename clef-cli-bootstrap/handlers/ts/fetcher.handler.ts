import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { createHash, randomUUID } from 'crypto';

export const fetcherHandler: ConceptHandler = {
  async fetch(input: Record<string, unknown>, storage: ConceptStorage) {
    const url = input.url as string;
    const expectedHash = input.expected_hash as string;

    try {
      const res = await globalThis.fetch(url);
      if (!res.ok) {
        return { variant: 'network_error', message: `HTTP ${res.status}` };
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const actual = `sha256:${createHash('sha256').update(buffer).digest('hex')}`;

      if (actual !== expectedHash) {
        return { variant: 'integrity_error', expected: expectedHash, actual };
      }

      const id = randomUUID();
      await storage.put('download', id, { url, expectedHash, size: buffer.length });
      return { variant: 'ok', download: id };
    } catch (err) {
      return { variant: 'network_error', message: String(err) };
    }
  },
};
