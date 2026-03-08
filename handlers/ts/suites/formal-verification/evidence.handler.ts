// ============================================================
// Evidence Handler — Formal Verification Suite
//
// Records, validates, retrieves, compares, minimizes, and lists
// verification evidence (proof certificates, counterexamples,
// solver logs).
// See Architecture doc Section 18.3
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

const VALID_ARTIFACT_TYPES = [
  'proof_certificate',
  'counterexample',
  'solver_log',
  'witness',
  'trace',
];

const COLLECTION = 'evidence';

function computeHash(content: string): string {
  return 'sha256-' + createHash('sha256').update(content).digest('hex');
}

export const evidenceHandler: ConceptHandler = {
  async record(input: Record<string, unknown>, storage: ConceptStorage) {
    const property_ref = input.property_ref as string;
    const artifact_type = input.artifact_type as string;
    const content = input.content as string;
    const solver = (input.solver as string) || undefined;
    const run_ref = (input.run_ref as string) || undefined;

    if (!VALID_ARTIFACT_TYPES.includes(artifact_type)) {
      return {
        variant: 'invalid',
        message: `Invalid artifact_type: ${artifact_type}. Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      };
    }

    if (!content || content.length === 0) {
      return {
        variant: 'invalid',
        message: 'Evidence content must be non-empty',
      };
    }

    const id = `ev-${randomUUID()}`;
    const content_hash = computeHash(content);
    const created_at = new Date().toISOString();

    await storage.put(COLLECTION, id, {
      id,
      property_ref,
      artifact_type,
      content,
      content_hash,
      solver,
      run_ref,
      created_at,
    });

    return {
      variant: 'ok',
      id,
      content_hash,
      artifact_type,
      property_ref,
    };
  },

  async validate(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const evidence = await storage.get(COLLECTION, id);
    if (!evidence) {
      return { variant: 'notfound', id };
    }

    const stored_hash = evidence.content_hash as string;
    const recomputed_hash = computeHash(evidence.content as string);

    return {
      variant: 'ok',
      valid: stored_hash === recomputed_hash,
      stored_hash,
      recomputed_hash,
    };
  },

  async retrieve(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const evidence = await storage.get(COLLECTION, id);
    if (!evidence) {
      return { variant: 'notfound', id };
    }

    return {
      variant: 'ok',
      id,
      property_ref: evidence.property_ref,
      artifact_type: evidence.artifact_type,
      content: evidence.content,
      content_hash: evidence.content_hash,
      solver: evidence.solver,
      run_ref: evidence.run_ref,
      created_at: evidence.created_at,
    };
  },

  async compare(input: Record<string, unknown>, storage: ConceptStorage) {
    const id_a = input.id_a as string;
    const id_b = input.id_b as string;

    const evA = await storage.get(COLLECTION, id_a);
    const evB = await storage.get(COLLECTION, id_b);

    if (!evA) return { variant: 'notfound', id: id_a };
    if (!evB) return { variant: 'notfound', id: id_b };

    const identical = (evA.content_hash as string) === (evB.content_hash as string);
    const same_type = (evA.artifact_type as string) === (evB.artifact_type as string);
    const same_property = (evA.property_ref as string) === (evB.property_ref as string);

    return {
      variant: 'ok',
      identical,
      same_type,
      same_property,
    };
  },

  async minimize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = input.id as string;

    const evidence = await storage.get(COLLECTION, id);
    if (!evidence) {
      return { variant: 'notfound', id };
    }

    if (evidence.artifact_type !== 'counterexample') {
      return {
        variant: 'not_applicable',
        artifact_type: evidence.artifact_type,
        message: 'Only counterexamples can be minimized',
      };
    }

    const originalContent = evidence.content as string;
    const original_size = originalContent.length;

    // Simulate minimization by trimming whitespace and removing redundant fields
    // For a real implementation this would use delta debugging or similar
    const minimizedContent = originalContent
      .replace(/\s+/g, ' ')
      .replace(/, "/g, ',"')
      .trim();

    const minimized_size = minimizedContent.length;
    const reduction_pct = ((original_size - minimized_size) / original_size) * 100;

    // Store minimized version as new evidence
    const minimized_id = `ev-${randomUUID()}`;
    const content_hash = computeHash(minimizedContent);
    const created_at = new Date().toISOString();

    await storage.put(COLLECTION, minimized_id, {
      id: minimized_id,
      property_ref: evidence.property_ref,
      artifact_type: 'counterexample',
      content: minimizedContent,
      content_hash,
      solver: evidence.solver,
      run_ref: evidence.run_ref,
      created_at,
      minimized_from: id,
    });

    return {
      variant: 'ok',
      original_id: id,
      minimized_id,
      original_size,
      minimized_size,
      reduction_pct,
    };
  },

  async list(input: Record<string, unknown>, storage: ConceptStorage) {
    const property_ref = input.property_ref as string | undefined;
    const artifact_type = input.artifact_type as string | undefined;

    let all = await storage.find(COLLECTION);

    if (property_ref) {
      all = all.filter(e => e.property_ref === property_ref);
    }
    if (artifact_type) {
      all = all.filter(e => e.artifact_type === artifact_type);
    }

    return {
      variant: 'ok',
      count: all.length,
      items: JSON.stringify(
        all.map(e => ({
          id: e.id,
          property_ref: e.property_ref,
          artifact_type: e.artifact_type,
          content_hash: e.content_hash,
          created_at: e.created_at,
        })),
      ),
    };
  },
};
