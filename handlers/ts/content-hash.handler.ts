// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ContentHash Handler
//
// Identify content by cryptographic digest, enabling deduplication,
// integrity verification, and immutable references. All versioned
// content is stored once and referenced by hash.
//
// Uses imperative style because store/retrieve/verify/delete need
// conditional logic with dynamic storage keys from find results.
// ============================================================

import { createHash } from 'crypto';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `content-hash-${++idCounter}`;
}

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

const _handler: ConceptHandler = {
  async store(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const content = input.content as string;
    const digest = computeSha256(content);

    // Check for existing content with same digest
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
    await storage.put('content-hash-by-digest', digest, {
      id,
      digest,
    });

    return { variant: 'ok', hash: digest };
  },

  async retrieve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;

    // Try index first
    const index = await storage.get('content-hash-by-digest', hash);
    if (index) {
      const record = await storage.get('content-hash', (index as Record<string, unknown>).id as string);
      if (record) {
        return { variant: 'ok', content: (record as Record<string, unknown>).content as string };
      }
    }

    // Fallback: search by digest
    const results = await storage.find('content-hash', { digest: hash });
    if (results.length === 0) {
      return { variant: 'notFound', message: `No object with digest '${hash}'` };
    }

    return { variant: 'ok', content: results[0].content as string };
  },

  async verify(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;
    const content = input.content as string;

    // First check if the hash exists in storage
    const index = await storage.get('content-hash-by-digest', hash);
    const results = await storage.find('content-hash', { digest: hash });

    if (!index && results.length === 0) {
      return { variant: 'notFound', message: `Hash '${hash}' not in store` };
    }

    const actualDigest = computeSha256(content);

    if (actualDigest === hash) {
      return { variant: 'valid' };
    }

    return { variant: 'corrupt', expected: hash, actual: actualDigest };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;

    // Check for references
    const refs = await storage.find('ref', { target: hash });
    if (refs.length > 0) {
      return {
        variant: 'referenced',
        message: `Object is referenced by ${refs.length} ref(s) and cannot be deleted`,
      };
    }

    // Find the content record
    const index = await storage.get('content-hash-by-digest', hash);
    if (index) {
      const id = (index as Record<string, unknown>).id as string;
      await storage.del('content-hash', id);
      await storage.del('content-hash-by-digest', hash);
      return { variant: 'ok' };
    }

    // Fallback: search by digest
    const results = await storage.find('content-hash', { digest: hash });
    if (results.length === 0) {
      return { variant: 'notFound', message: `Hash '${hash}' not in store` };
    }

    for (const r of results) {
      await storage.del('content-hash', r.id as string);
    }
    return { variant: 'ok' };
  },
};

export const contentHashHandler = _handler;

/** Reset the ID counter. Useful for testing. */
export function resetContentHashCounter(): void {
  idCounter = 0;
}
