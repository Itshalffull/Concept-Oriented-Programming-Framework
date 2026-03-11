// ============================================================
// ErdNotation Handler
//
// Notation provider for Entity-Relationship Diagrams (ERD).
// Defines entity, weak-entity, attribute, and relationship
// nodes connected by one-to-one, one-to-many, and many-to-many
// cardinality edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'erd';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Entity-Relationship Diagram notation with entity, weak-entity, attribute, and relationship nodes connected by cardinality edges.',
  node_types: [
    {
      type_key: 'entity',
      label: 'Entity',
      shape: 'rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'weak-entity',
      label: 'Weak Entity',
      shape: 'rectangle-double',
      default_fill: '#FFF3E0',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'attribute',
      label: 'Attribute',
      shape: 'ellipse',
      default_fill: '#E8F5E9',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'relationship',
      label: 'Relationship',
      shape: 'diamond',
      default_fill: '#F3E5F5',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'one-to-one',
      label: 'One to One',
      line_style: 'solid',
      arrow_type: 'none',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'one-to-many',
      label: 'One to Many',
      line_style: 'solid',
      arrow_type: 'crow-foot',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'many-to-many',
      label: 'Many to Many',
      line_style: 'solid',
      arrow_type: 'crow-foot-both',
      default_color: null,
      requires_label: false,
    },
  ],
  connection_rules: [],
  preferred_layout: 'force-directed',
};

export const erdNotationHandler: ConceptHandler = {
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

export default erdNotationHandler;
