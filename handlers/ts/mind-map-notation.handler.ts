// ============================================================
// MindMapNotation Handler
//
// Notation provider for mind map diagrams. Defines central-topic,
// main-branch, and sub-branch node types connected by curved
// branch edges, laid out as a radial tree.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'mind-map';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Mind map notation with central topic, main branches, and sub-branches connected by curved branch edges.',
  node_types: [
    {
      type_key: 'central-topic',
      label: 'Central Topic',
      shape: 'rounded-rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'main-branch',
      label: 'Main Branch',
      shape: 'rounded-rectangle',
      default_fill: '#E8F5E9',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'sub-branch',
      label: 'Sub Branch',
      shape: 'rectangle',
      default_fill: '#FFF3E0',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'branch',
      label: 'Branch',
      line_style: 'curved',
      arrow_type: 'none',
      default_color: null,
      requires_label: false,
    },
  ],
  connection_rules: [],
  preferred_layout: 'tree',
};

export const mindMapNotationHandler: ConceptHandler = {
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

export default mindMapNotationHandler;
