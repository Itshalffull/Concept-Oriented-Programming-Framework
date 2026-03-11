// ============================================================
// StatechartNotation Handler
//
// Notation provider for statechart (state machine) diagrams.
// Defines state, initial, final, and composite-state nodes
// connected by labeled transition edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'statechart';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Statechart notation with state, initial, final, and composite-state nodes connected by labeled transition edges.',
  node_types: [
    {
      type_key: 'state',
      label: 'State',
      shape: 'rounded-rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'initial',
      label: 'Initial',
      shape: 'circle-filled',
      default_fill: '#333333',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'final',
      label: 'Final',
      shape: 'circle-bullseye',
      default_fill: '#333333',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'composite-state',
      label: 'Composite State',
      shape: 'rounded-rectangle-expand',
      default_fill: '#E0F7FA',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'transition',
      label: 'Transition',
      line_style: 'solid',
      arrow_type: 'forward',
      default_color: null,
      requires_label: true,
    },
  ],
  connection_rules: [],
  preferred_layout: 'hierarchical',
};

export const statechartNotationHandler: ConceptHandler = {
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

export default statechartNotationHandler;
