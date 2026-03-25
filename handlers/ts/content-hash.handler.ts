// @clef-handler style=functional
// ============================================================
// ContentHash Handler
//
// Identify content by cryptographic digest, enabling deduplication,
// integrity verification, and immutable references. All versioned
// content is stored once and referenced by hash.
//
// store/verify are functional. retrieve/delete use imperative
// overrides because they need dynamic key lookups from find results.
// ============================================================

import { createHash } from 'crypto';
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../runtime/types.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `content-hash-${++idCounter}`;
}

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

const _handler: FunctionalConceptHandler = {
  store(input: Record<string, unknown>): StorageProgram<Result> {
    const content = input.content as string;
    if (!content || (typeof content === 'string' && content.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'content is required' }) as StorageProgram<Result>;
    }
    const digest = computeSha256(content);
    const id = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = find(p, 'content-hash', { digest }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'ok', { hash: digest }),
      (_elseP) => {
        let q = createProgram();
        q = put(q, 'content-hash', id, {
          id, digest, content,
          size: content.length,
          created: now,
          algorithm: 'sha-256',
        });
        q = put(q, 'content-hash-by-digest', digest, { id, digest });
        return complete(q, 'ok', { hash: digest });
      },
    ) as StorageProgram<Result>;
  },

  // retrieve uses imperative override — needs dynamic get by ID from index
  retrieve(input: Record<string, unknown>): StorageProgram<Result> {
    const hash = input.hash as string;
    let p = createProgram();
    p = find(p, 'content-hash', { digest: hash }, 'byDigest');
    return branch(p,
      (b) => (b.byDigest as unknown[]).length === 0,
      (notFoundP) => complete(notFoundP, 'notFound', { message: `No object with digest '${hash}'` }),
      (foundP) => completeFrom(foundP, 'ok', (b) => {
        const results = b.byDigest as Record<string, unknown>[];
        return { content: results[0].content as string };
      }),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>): StorageProgram<Result> {
    const hash = input.hash as string;
    const content = input.content as string;
    const actualDigest = computeSha256(content);

    let p = createProgram();
    p = find(p, 'content-hash', { digest: hash }, 'byDigest');

    return branch(p,
      (b) => (b.byDigest as unknown[]).length === 0,
      (notFoundP) => complete(notFoundP, 'notFound', { message: `Hash '${hash}' not in store` }),
      (foundP) => {
        if (actualDigest === hash) {
          return complete(foundP, 'valid', {});
        }
        return complete(foundP, 'corrupt', { expected: hash, actual: actualDigest });
      },
    ) as StorageProgram<Result>;
  },

  // delete uses imperative override — needs dynamic key deletion from find results
  delete(input: Record<string, unknown>): StorageProgram<Result> {
    const hash = input.hash as string;
    let p = createProgram();
    p = find(p, 'ref', { target: hash }, 'refs');
    p = find(p, 'content-hash', { digest: hash }, 'byDigest');
    return branch(p,
      (b) => (b.refs as unknown[]).length > 0,
      (refP) => completeFrom(refP, 'referenced', (b) => ({
        message: `Object is referenced by ${(b.refs as unknown[]).length} ref(s) and cannot be deleted`,
      })),
      (elseP) => branch(elseP,
        (b) => (b.byDigest as unknown[]).length === 0,
        (notFoundP) => complete(notFoundP, 'notFound', { message: `Hash '${hash}' not in store` }),
        (okP) => complete(okP, 'ok', {}),
      ),
    ) as StorageProgram<Result>;
  },
};

const _base = autoInterpret(_handler);

export const contentHashHandler: typeof _base & {
  retrieve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
  delete(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result>;
} = Object.assign(Object.create(Object.getPrototypeOf(_base)), _base, {
  async retrieve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;

    const index = await storage.get('content-hash-by-digest', hash);
    if (index) {
      const record = await storage.get('content-hash', (index as Record<string, unknown>).id as string);
      if (record) {
        return { variant: 'ok', content: (record as Record<string, unknown>).content as string };
      }
    }

    const results = await storage.find('content-hash', { digest: hash });
    if (results.length === 0) {
      return { variant: 'notFound', message: `No object with digest '${hash}'` };
    }
    return { variant: 'ok', content: results[0].content as string };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const hash = input.hash as string;

    const refs = await storage.find('ref', { target: hash });
    if (refs.length > 0) {
      return {
        variant: 'referenced',
        message: `Object is referenced by ${refs.length} ref(s) and cannot be deleted`,
      };
    }

    const index = await storage.get('content-hash-by-digest', hash);
    if (index) {
      const id = (index as Record<string, unknown>).id as string;
      await storage.del('content-hash', id);
      await storage.del('content-hash-by-digest', hash);
      return { variant: 'ok' };
    }

    const results = await storage.find('content-hash', { digest: hash });
    if (results.length === 0) {
      return { variant: 'notFound', message: `Hash '${hash}' not in store` };
    }
    for (const r of results) {
      await storage.del('content-hash', r.id as string);
    }
    return { variant: 'ok' };
  },
});

/** Reset the ID counter. Useful for testing. */
export function resetContentHashCounter(): void {
  idCounter = 0;
}
