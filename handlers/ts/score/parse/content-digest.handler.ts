// ============================================================
// ContentDigest Handler — Stub
//
// Full implementation deferred to Phase 4 (Scope Resolution
// & Cross-File Linking). Concept spec is present in the Parse
// Suite manifest; this stub returns unsupported for all actions.
// ============================================================

import type { ConceptHandler } from '../../../../runtime/types.js';

export const contentDigestHandler: ConceptHandler = {
  async compute() {
    return { variant: 'unsupportedAlgorithm', algorithm: 'stub — not yet implemented' };
  },
  async lookup() {
    return { variant: 'notfound' };
  },
  async equivalent() {
    return { variant: 'no', diffSummary: 'stub — not yet implemented' };
  },
};
