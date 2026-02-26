// ============================================================
// DefinitionUnit Handler — Stub
//
// Full implementation deferred to Phase 4 (Scope Resolution
// & Cross-File Linking). Concept spec is present in the Parse
// Suite manifest; this stub returns unsupported for all actions.
// ============================================================

import type { ConceptHandler } from '../../../../runtime/types.js';

export const definitionUnitHandler: ConceptHandler = {
  async extract() {
    return { variant: 'notADefinition', nodeType: 'stub — not yet implemented' };
  },
  async findBySymbol() {
    return { variant: 'notfound' };
  },
  async findByPattern() {
    return { variant: 'ok', units: '[]' };
  },
  async diff() {
    return { variant: 'same' };
  },
};
