// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, mergeFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_STATUSES = new Set([
  'unverified', 'supported', 'partial', 'unsupported', 'contested',
]);

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

const _claimHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Claim' }) as StorageProgram<Result>;
  },

  /**
   * Extract a new claim from a report block for verification tracking.
   * Sets initial verification status to "unverified".
   */
  extract(input: Record<string, unknown>) {
    const report_entity_id = toStr(input.report_entity_id);
    const block_id = toStr(input.block_id);
    const claim_text = toStr(input.claim_text);

    if (!report_entity_id || report_entity_id.trim() === '') {
      return complete(createProgram(), 'error', { message: 'report_entity_id is required' }) as StorageProgram<Result>;
    }
    if (!claim_text || claim_text.trim() === '') {
      return complete(createProgram(), 'error', { message: 'claim_text is required' }) as StorageProgram<Result>;
    }

    const claimId = randomId();
    const now = new Date().toISOString();

    const record = {
      claim: claimId,
      report_entity_id,
      block_id,
      claim_text,
      status: 'unverified',
      support_score: null,
      verified_at: null,
      verified_by: null,
      createdAt: now,
    };

    let p = createProgram();
    p = put(p, 'claim', claimId, record);
    return complete(p, 'ok', { claim: claimId }) as StorageProgram<Result>;
  },

  /**
   * Update the verification status and support score for a claim.
   * Validates status enum and score range before writing.
   */
  updateVerification(input: Record<string, unknown>) {
    const claimId = toStr(input.claim);
    const status = toStr(input.status);
    const support_score = typeof input.support_score === 'number'
      ? input.support_score
      : parseFloat(toStr(input.support_score));
    const verified_by = toStr(input.verified_by);

    if (!VALID_STATUSES.has(status)) {
      return complete(createProgram(), 'invalid', {
        message: `Invalid verification status "${status}". Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    if (isNaN(support_score) || support_score < 0.0 || support_score > 1.0) {
      return complete(createProgram(), 'invalid', {
        message: `support_score must be between 0.0 and 1.0, got ${input.support_score}`,
      }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'claim', claimId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mergeFrom(b, 'claim', claimId, (_bindings) => ({
          status,
          support_score,
          verified_at: now,
          verified_by,
        }));
        return complete(b2, 'ok', { claim: claimId }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: 'No claim exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return the claim and its current verification state.
   */
  get(input: Record<string, unknown>) {
    const claimId = toStr(input.claim);

    let p = createProgram();
    p = spGet(p, 'claim', claimId, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          claim: claimId,
          claim_text: rec.claim_text as string,
          status: rec.status as string,
          support_score: (rec.support_score as number) ?? 0,
          report_entity_id: rec.report_entity_id as string,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { message: 'No claim exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return a JSON array of all claims extracted from the given report entity.
   */
  listByReport(input: Record<string, unknown>) {
    const report_entity_id = toStr(input.report_entity_id);

    let p = createProgram();
    p = find(p, 'claim', { report_entity_id }, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      claims: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },

  /**
   * Return a JSON array of claims that are unverified, partial,
   * unsupported, or contested for the given report entity.
   */
  listUnsupported(input: Record<string, unknown>) {
    const report_entity_id = toStr(input.report_entity_id);

    let p = createProgram();
    p = find(p, 'claim', { report_entity_id }, 'results');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.results as Array<Record<string, unknown>>) || [];
      const unsupported = all.filter(
        (c) => c.status !== 'supported',
      );
      return { claims: JSON.stringify(unsupported) };
    }) as StorageProgram<Result>;
  },

  /**
   * Build a graph of claim nodes and verification edges for the report entity.
   * Nodes are the claims; edges connect each claim to its verifier (verified_by).
   */
  evidenceGraph(input: Record<string, unknown>) {
    const report_entity_id = toStr(input.report_entity_id);

    let p = createProgram();
    p = find(p, 'claim', { report_entity_id }, 'results');
    return completeFrom(p, 'ok', (bindings) => {
      const claims = (bindings.results as Array<Record<string, unknown>>) || [];
      const nodes = claims.map((c) => ({
        id: toStr(c.claim),
        label: toStr(c.claim_text).slice(0, 80),
        status: toStr(c.status),
        support_score: (c.support_score as number) ?? null,
      }));
      const edges = claims
        .filter((c) => c.verified_by)
        .map((c) => ({
          source: toStr(c.claim),
          target: toStr(c.verified_by),
          label: toStr(c.status),
        }));
      return { graph: JSON.stringify({ nodes, edges }) };
    }) as StorageProgram<Result>;
  },
};

export const claimHandler = autoInterpret(_claimHandler);
