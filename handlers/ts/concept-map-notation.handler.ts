// ============================================================
// ConceptMapNotation Handler
//
// Notation provider for concept map diagrams. Defines concept
// and linking-phrase node types connected by labeled proposition
// edges, laid out with force-directed positioning.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'concept-map';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Concept map notation with concept nodes and linking phrases connected by labeled proposition edges.',
  node_types: [
    {
      type_key: 'concept',
      label: 'Concept',
      shape: 'rounded-rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'linking-phrase',
      label: 'Linking Phrase',
      shape: 'rectangle-small',
      default_fill: '#FFF9C4',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'proposition',
      label: 'Proposition',
      line_style: 'solid',
      arrow_type: 'forward',
      default_color: null,
      requires_label: true,
    },
  ],
  connection_rules: [],
  preferred_layout: 'force-directed',
};

export const conceptMapNotationHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.get('notation-provider', NOTATION_NAME);
    if (existing) {
      return { variant: 'ok', name: NOTATION_NAME, category: 'diagram_notation' };
    }

    await storage.put('notation-provider', NOTATION_NAME, {
      id: NOTATION_NAME,
      name: NOTATION_NAME,
      category: 'diagram_notation',
      definition: DEFINITION,
    });

    return { variant: 'ok', name: NOTATION_NAME, category: 'diagram_notation' };
  },

  async getDefinition(_input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      notation: DEFINITION,
    };
  },
};

export default conceptMapNotationHandler;
