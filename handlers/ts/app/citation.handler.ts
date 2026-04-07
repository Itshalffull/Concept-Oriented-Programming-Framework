// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, mergeFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_VERIFICATION_STATUSES = new Set([
  'pending', 'verified', 'weak', 'refuted', 'manual_override',
]);

const VALID_VERIFICATION_METHODS = new Set([
  'nli_cascade', 'llm_judge', 'embedding_similarity', 'manual',
]);

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

/**
 * Derive a verification status from a support score.
 * >= 0.8 → verified, >= 0.4 → weak, < 0.4 → refuted
 */
function scoreToStatus(score: number): string {
  if (score >= 0.8) return 'verified';
  if (score >= 0.4) return 'weak';
  return 'refuted';
}

const _citationHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Citation' }) as StorageProgram<Result>;
  },

  /**
   * Create a citation linking a claim to a supporting snippet.
   * Detects duplicates by searching for existing (claim_id, snippet_id) pairs.
   */
  link(input: Record<string, unknown>) {
    const claim_id = toStr(input.claim_id);
    const snippet_id = toStr(input.snippet_id);
    const citation_key = toStr(input.citation_key);

    if (!claim_id || claim_id.trim() === '') {
      return complete(createProgram(), 'error', { message: 'claim_id is required' }) as StorageProgram<Result>;
    }
    if (!snippet_id || snippet_id.trim() === '') {
      return complete(createProgram(), 'error', { message: 'snippet_id is required' }) as StorageProgram<Result>;
    }
    if (!citation_key || citation_key.trim() === '') {
      return complete(createProgram(), 'error', { message: 'citation_key is required' }) as StorageProgram<Result>;
    }

    const citationId = randomId();
    const now = new Date().toISOString();

    let p = createProgram();
    // Check for duplicate (claim_id + snippet_id pair)
    p = find(p, 'citation', { claim_id, snippet_id }, 'existing_list');
    p = branch(p,
      (bindings) => {
        const list = bindings.existing_list as unknown[];
        return Array.isArray(list) && list.length > 0;
      },
      // Duplicate found
      (b) => completeFrom(b, 'duplicate', (bindings) => {
        const list = bindings.existing_list as Array<Record<string, unknown>>;
        const existing = list[0];
        return { existing: (existing.citation as string) || '' };
      }) as StorageProgram<Result>,
      // No duplicate — create
      (b) => {
        const record = {
          citation: citationId,
          claim_id,
          snippet_id,
          citation_key,
          support_score: 0.0,
          verification_status: 'pending',
          verification_method: 'manual',
          verified_at: null,
          display_format: null,
          createdAt: now,
        };
        let b2 = put(b, 'citation', citationId, record);
        return complete(b2, 'ok', { citation: citationId }) as StorageProgram<Result>;
      },
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Record the verification assessment for a citation.
   * Derives verification_status from the support score threshold.
   */
  verify(input: Record<string, unknown>) {
    const citationId = toStr(input.citation);
    const support_score = typeof input.support_score === 'number'
      ? input.support_score
      : parseFloat(toStr(input.support_score));
    const verification_method = toStr(input.verification_method);

    if (isNaN(support_score) || support_score < 0.0 || support_score > 1.0) {
      return complete(createProgram(), 'invalid', {
        message: `support_score must be between 0.0 and 1.0, got ${input.support_score}`,
      }) as StorageProgram<Result>;
    }

    if (!VALID_VERIFICATION_METHODS.has(verification_method)) {
      return complete(createProgram(), 'invalid', {
        message: `Invalid verification_method "${verification_method}". Must be one of: ${[...VALID_VERIFICATION_METHODS].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const derived_status = scoreToStatus(support_score);
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'citation', citationId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mergeFrom(b, 'citation', citationId, (_bindings) => ({
          support_score,
          verification_status: derived_status,
          verification_method,
          verified_at: now,
        }));
        return complete(b2, 'ok', { citation: citationId }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: 'No citation exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Manually override the verification status with justification.
   * Sets verification_method to "manual" and stores the reason.
   */
  override(input: Record<string, unknown>) {
    const citationId = toStr(input.citation);
    const verification_status = toStr(input.verification_status);
    const reason = toStr(input.reason);

    if (!VALID_VERIFICATION_STATUSES.has(verification_status)) {
      return complete(createProgram(), 'invalid', {
        message: `Invalid verification_status "${verification_status}". Must be one of: ${[...VALID_VERIFICATION_STATUSES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'citation', citationId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mergeFrom(b, 'citation', citationId, (_bindings) => ({
          verification_status,
          verification_method: 'manual',
          verified_at: now,
          display_format: reason,
        }));
        return complete(b2, 'ok', { citation: citationId }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: 'No citation exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return the citation and its assessment metadata.
   */
  get(input: Record<string, unknown>) {
    const citationId = toStr(input.citation);

    let p = createProgram();
    p = spGet(p, 'citation', citationId, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          citation: citationId,
          claim_id: rec.claim_id as string,
          snippet_id: rec.snippet_id as string,
          support_score: (rec.support_score as number) ?? 0,
          verification_status: rec.verification_status as string,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { message: 'No citation exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return a JSON array of all citations supporting the given claim.
   */
  listByClaim(input: Record<string, unknown>) {
    const claim_id = toStr(input.claim_id);

    let p = createProgram();
    p = find(p, 'citation', { claim_id }, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      citations: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },

  /**
   * Return a JSON array of all citations referencing the given snippet.
   */
  listBySnippet(input: Record<string, unknown>) {
    const snippet_id = toStr(input.snippet_id);

    let p = createProgram();
    p = find(p, 'citation', { snippet_id }, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      citations: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },
};

export const citationHandler = autoInterpret(_citationHandler);
