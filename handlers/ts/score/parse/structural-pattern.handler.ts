// ============================================================
// StructuralPattern Handler — Stub
//
// Full implementation deferred to Phase 6 (Search & Discovery).
// Concept spec is present in the Parse Kit manifest; this stub
// returns unsupported for all actions.
// ============================================================

import type { ConceptHandler } from '../../../../kernel/src/types.js';

export const structuralPatternHandler: ConceptHandler = {
  async create() {
    return { variant: 'invalidSyntax', message: 'stub — not yet implemented', position: 0 };
  },
  async match() {
    return { variant: 'noMatches' };
  },
  async matchProject() {
    return { variant: 'noMatches' };
  },
};
