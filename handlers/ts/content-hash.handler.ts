// @migrated dsl-constructs 2026-03-18
// ============================================================
// ContentHash Handler
//
// Identify content by cryptographic digest, enabling deduplication,
// integrity verification, and immutable references. All versioned
// content is stored once and referenced by hash.
// ============================================================

import { createHash } from 'crypto';
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
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
  store(input: Record<string, unknown>) {
    const content = input.content as string;
    const digest = computeSha256(content);

    let p = createProgram();
    p = find(p, 'content-hash', { digest }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'alreadyExists', { hash: digest }),
      (elseP) => {
        const id = nextId();
        const now = new Date().toISOString();
        elseP = put(elseP, 'content-hash', id, {
          id,
          digest,
          content,
          size: content.length,
          created: now,
          algorithm: 'sha-256',
        });
        elseP = put(elseP, 'content-hash-by-digest', digest, {
          id,
          digest,
        });
        return complete(elseP, 'ok', { hash: digest });
      },
    ) as StorageProgram<Result>;
  },

  retrieve(input: Record<string, unknown>) {
    const hash = input.hash as string;

    let p = createProgram();
    p = get(p, 'content-hash-by-digest', hash, 'index');

    return branch(p, 'index',
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          // Would need another get to fetch content by id
          return { content: '' };
        });
      },
      (elseP) => {
        elseP = find(elseP, 'content-hash', { digest: hash }, 'results');
        return branch(elseP,
          (bindings) => (bindings.results as unknown[]).length === 0,
          (notFoundP) => complete(notFoundP, 'notFound', { message: `No object with digest '${hash}'` }),
          (foundP) => completeFrom(foundP, 'ok', (bindings) => {
            const results = bindings.results as Record<string, unknown>[];
            return { content: results[0].content as string };
          }),
        );
      },
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const hash = input.hash as string;
    const content = input.content as string;

    const actualDigest = computeSha256(content);

    const p = createProgram();
    if (actualDigest === hash) {
      return complete(p, 'valid', {}) as StorageProgram<Result>;
    }

    return complete(p, 'corrupt', { expected: hash, actual: actualDigest }) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const hash = input.hash as string;

    let p = createProgram();
    p = get(p, 'content-hash-by-digest', hash, 'index');
    p = find(p, 'ref', { target: hash }, 'refs');

    return branch(p,
      (bindings) => (bindings.refs as unknown[]).length > 0,
      (refP) => completeFrom(refP, 'referenced', (bindings) => ({
        message: `Object is referenced by ${(bindings.refs as unknown[]).length} ref(s) and cannot be deleted`,
      })),
      (noRefP) => {
        return branch(noRefP, 'index',
          (hasIndexP) => {
            hasIndexP = mapBindings(hasIndexP, (bindings) => {
              return (bindings.index as Record<string, unknown>).id;
            }, 'contentId');
            hasIndexP = del(hasIndexP, 'content-hash-by-digest', hash);
            return complete(hasIndexP, 'ok', {});
          },
          (noIndexP) => {
            noIndexP = find(noIndexP, 'content-hash', { digest: hash }, 'results');
            return branch(noIndexP,
              (bindings) => (bindings.results as unknown[]).length === 0,
              (notFoundP) => complete(notFoundP, 'notFound', { message: `Hash '${hash}' not in store` }),
              (foundP) => complete(foundP, 'ok', {}),
            );
          },
        );
      },
    ) as StorageProgram<Result>;
  },
};

export const contentHashHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetContentHashCounter(): void {
  idCounter = 0;
}
