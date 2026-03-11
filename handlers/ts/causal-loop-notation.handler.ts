// ============================================================
// CausalLoopNotation Handler
//
// Notation provider for causal loop (system dynamics) diagrams.
// Defines a single variable node type connected by positive
// (reinforcing) and negative (balancing) influence edges,
// laid out in a circular arrangement.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'causal-loop';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Causal loop diagram notation with variable nodes connected by positive (reinforcing) and negative (balancing) influence edges.',
  node_types: [
    {
      type_key: 'variable',
      label: 'Variable',
      shape: 'rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'positive',
      label: 'Positive',
      line_style: 'solid',
      arrow_type: 'forward',
      default_color: '#4CAF50',
      requires_label: false,
    },
    {
      type_key: 'negative',
      label: 'Negative',
      line_style: 'dashed',
      arrow_type: 'forward',
      default_color: '#F44336',
      requires_label: false,
    },
  ],
  connection_rules: [
    {
      source_type: 'variable',
      target_type: 'variable',
      allowed_edge_types: ['positive', 'negative'],
      min_outgoing: null,
      max_outgoing: null,
      min_incoming: null,
      max_incoming: null,
    },
  ],
  preferred_layout: 'circular',
};

export const causalLoopNotationHandler: ConceptHandler = {
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

export default causalLoopNotationHandler;
