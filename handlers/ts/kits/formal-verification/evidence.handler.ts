// Evidence Concept Implementation — Formal Verification Suite
// Record, validate, retrieve, compare, and minimize verification evidence
// (proof certificates, counterexamples, model traces, coverage reports, solver logs).
// See Architecture doc Section 18.3
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';

const RELATION = 'evidence-records';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'sha256-' + Math.abs(hash).toString(16).padStart(12, '0');
}

const VALID_ARTIFACT_TYPES = [
  'proof_certificate',
  'counterexample',
  'model_trace',
  'coverage_report',
  'solver_log',
] as const;

export const evidenceHandler: ConceptHandler = {
  async record(input, storage) {
    const property_ref = input.property_ref as string;
    const artifact_type = input.artifact_type as string;
    const content = input.content as string;
    const solver = input.solver as string | undefined;
    const run_ref = input.run_ref as string | undefined;

    if (!VALID_ARTIFACT_TYPES.includes(artifact_type as any)) {
      return {
        variant: 'invalid',
        message: `Invalid artifact_type "${artifact_type}". Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      };
    }

    if (!content || content.trim() === '') {
      return { variant: 'invalid', message: 'content must be non-empty' };
    }

    const content_hash = simpleHash(content);
    const id = `ev-${simpleHash(property_ref + ':' + artifact_type + ':' + content_hash)}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, id, {
      id,
      property_ref,
      artifact_type,
      content,
      content_hash,
      solver: solver || '',
      run_ref: run_ref || '',
      created_at: now,
    });

    return { variant: 'ok', id, content_hash, artifact_type, property_ref };
  },

  async validate(input, storage) {
    const id = input.id as string;

    const evidence = await storage.get(RELATION, id);
    if (!evidence) {
      return { variant: 'notfound', id };
    }

    const storedHash = evidence.content_hash as string;
    const recomputedHash = simpleHash(evidence.content as string);
    const valid = storedHash === recomputedHash;

    return {
      variant: 'ok',
      id,
      valid,
      stored_hash: storedHash,
      recomputed_hash: recomputedHash,
    };
  },

  async retrieve(input, storage) {
    const id = input.id as string;

    const evidence = await storage.get(RELATION, id);
    if (!evidence) {
      return { variant: 'notfound', id };
    }

    return {
      variant: 'ok',
      id,
      property_ref: evidence.property_ref as string,
      artifact_type: evidence.artifact_type as string,
      content: evidence.content as string,
      content_hash: evidence.content_hash as string,
      solver: evidence.solver as string,
      run_ref: evidence.run_ref as string,
      created_at: evidence.created_at as string,
    };
  },

  async compare(input, storage) {
    const id_a = input.id_a as string;
    const id_b = input.id_b as string;

    const evidenceA = await storage.get(RELATION, id_a);
    if (!evidenceA) {
      return { variant: 'notfound', id: id_a };
    }

    const evidenceB = await storage.get(RELATION, id_b);
    if (!evidenceB) {
      return { variant: 'notfound', id: id_b };
    }

    const hashA = evidenceA.content_hash as string;
    const hashB = evidenceB.content_hash as string;
    const identical = hashA === hashB;

    return {
      variant: 'ok',
      id_a,
      id_b,
      hash_a: hashA,
      hash_b: hashB,
      identical,
      same_type: evidenceA.artifact_type === evidenceB.artifact_type,
      same_property: evidenceA.property_ref === evidenceB.property_ref,
    };
  },

  async minimize(input, storage) {
    const id = input.id as string;

    const evidence = await storage.get(RELATION, id);
    if (!evidence) {
      return { variant: 'notfound', id };
    }

    const artifactType = evidence.artifact_type as string;

    // Only counterexamples can be minimized
    if (artifactType !== 'counterexample') {
      return { variant: 'not_applicable', id, artifact_type: artifactType, message: 'Only counterexamples can be minimized' };
    }

    // Mock minimization: simulate reducing the counterexample content
    const originalContent = evidence.content as string;
    const minimizedContent = originalContent.length > 20
      ? originalContent.substring(0, Math.ceil(originalContent.length * 0.6))
      : originalContent;

    const minimizedHash = simpleHash(minimizedContent);
    const minimizedId = `ev-min-${simpleHash(id + ':minimized')}`;
    const now = new Date().toISOString();

    await storage.put(RELATION, minimizedId, {
      id: minimizedId,
      property_ref: evidence.property_ref as string,
      artifact_type: 'counterexample',
      content: minimizedContent,
      content_hash: minimizedHash,
      solver: evidence.solver as string,
      run_ref: evidence.run_ref as string,
      minimized_from: id,
      created_at: now,
    });

    return {
      variant: 'ok',
      original_id: id,
      minimized_id: minimizedId,
      original_size: originalContent.length,
      minimized_size: minimizedContent.length,
      reduction_pct: 1 - (minimizedContent.length / originalContent.length),
    };
  },

  async list(input, storage) {
    const property_ref = input.property_ref as string | undefined;
    const artifact_type = input.artifact_type as string | undefined;

    let all = await storage.find(RELATION);

    if (property_ref) {
      all = all.filter((e: any) => e.property_ref === property_ref);
    }
    if (artifact_type) {
      all = all.filter((e: any) => e.artifact_type === artifact_type);
    }

    const items = all.map((e: any) => ({
      id: e.id,
      property_ref: e.property_ref,
      artifact_type: e.artifact_type,
      content_hash: e.content_hash,
      solver: e.solver,
      created_at: e.created_at,
    }));

    return { variant: 'ok', items: JSON.stringify(items), count: items.length };
  },
};
