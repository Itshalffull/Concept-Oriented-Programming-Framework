// ============================================================
// ContentHash Handler
//
// Identify content by cryptographic digest, enabling deduplication,
// integrity verification, and immutable references. All versioned
// content is stored once and referenced by hash.
// ============================================================

import { createHash } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `content-hash-${++idCounter}`;
}

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export const contentHashHandler: ConceptHandler = {
  async store(input: Record<string, unknown>, storage: ConceptStorage) {
    const content = input.content as string;

    const digest = computeSha256(content);

    // Check if this digest already exists
    const existing = await storage.find('content-hash', { digest });
    if (existing.length > 0) {
      return { variant: 'alreadyExists', hash: digest };
    }

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('content-hash', id, {
      id,
      digest,
      content,
      size: content.length,
      created: now,
      algorithm: 'sha-256',
    });

    // Also index by digest for fast lookups
    await storage.put('content-hash-by-digest', digest, {
      id,
      digest,
    });

    return { variant: 'ok', hash: digest };
  },

  async retrieve(input: Record<string, unknown>, storage: ConceptStorage) {
    const hash = input.hash as string;

    const index = await storage.get('content-hash-by-digest', hash);
    if (!index) {
      // Fallback: search by digest field
      const results = await storage.find('content-hash', { digest: hash });
      if (results.length === 0) {
        return { variant: 'notFound', message: `No object with digest '${hash}'` };
      }
      return { variant: 'ok', content: results[0].content as string };
    }

    const record = await storage.get('content-hash', index.id as string);
    if (!record) {
      return { variant: 'notFound', message: `No object with digest '${hash}'` };
    }

    return { variant: 'ok', content: record.content as string };
  },

  async verify(input: Record<string, unknown>, storage: ConceptStorage) {
    const hash = input.hash as string;
    const content = input.content as string;

    // Check if hash exists in store
    const index = await storage.get('content-hash-by-digest', hash);
    if (!index) {
      const results = await storage.find('content-hash', { digest: hash });
      if (results.length === 0) {
        return { variant: 'notFound', message: `Hash '${hash}' not in store` };
      }
    }

    const actualDigest = computeSha256(content);

    if (actualDigest === hash) {
      return { variant: 'valid' };
    }

    return { variant: 'corrupt', expected: hash, actual: actualDigest };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage) {
    const hash = input.hash as string;

    // Find the record by digest
    const index = await storage.get('content-hash-by-digest', hash);
    if (!index) {
      const results = await storage.find('content-hash', { digest: hash });
      if (results.length === 0) {
        return { variant: 'notFound', message: `Hash '${hash}' not in store` };
      }
      // Check for references
      const refs = await storage.find('ref', { target: hash });
      if (refs.length > 0) {
        return { variant: 'referenced', message: `Object is referenced by ${refs.length} ref(s) and cannot be deleted` };
      }
      await storage.del('content-hash', results[0].id as string);
      return { variant: 'ok' };
    }

    // Check for references
    const refs = await storage.find('ref', { target: hash });
    if (refs.length > 0) {
      return { variant: 'referenced', message: `Object is referenced by ${refs.length} ref(s) and cannot be deleted` };
    }

    await storage.del('content-hash', index.id as string);
    await storage.del('content-hash-by-digest', hash);

    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetContentHashCounter(): void {
  idCounter = 0;
}
