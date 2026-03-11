// ============================================================
// C4Notation Handler
//
// Notation provider for C4 model architecture diagrams. Defines
// person, system, container, component, and external-system
// nodes connected by labeled relationship edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'c4';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'C4 model notation with person, system, container, component, and external-system nodes connected by labeled relationship edges.',
  node_types: [
    {
      type_key: 'person',
      label: 'Person',
      shape: 'person-shape',
      default_fill: '#08427B',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'system',
      label: 'System',
      shape: 'rectangle',
      default_fill: '#1168BD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'container',
      label: 'Container',
      shape: 'rectangle',
      default_fill: '#438DD5',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'component',
      label: 'Component',
      shape: 'rectangle',
      default_fill: '#85BBF0',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'external-system',
      label: 'External System',
      shape: 'rectangle',
      default_fill: '#999999',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'relationship',
      label: 'Relationship',
      line_style: 'solid',
      arrow_type: 'forward',
      default_color: null,
      requires_label: true,
    },
  ],
  connection_rules: [],
  preferred_layout: 'hierarchical',
};

export const c4NotationHandler: ConceptHandler = {
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

export default c4NotationHandler;
