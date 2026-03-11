// ============================================================
// FlowchartNotation Handler
//
// Notation provider for standard flowchart diagrams. Defines
// process, decision, terminal, data, predefined-process, and
// document node types with sequence-flow edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'flowchart';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Standard flowchart notation with process, decision, terminal, data, predefined-process, and document shapes connected by sequence flows.',
  node_types: [
    {
      type_key: 'process',
      label: 'Process',
      shape: 'rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'decision',
      label: 'Decision',
      shape: 'diamond',
      default_fill: '#FFF3E0',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'terminal',
      label: 'Terminal',
      shape: 'stadium',
      default_fill: '#E8F5E9',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'data',
      label: 'Data',
      shape: 'parallelogram',
      default_fill: '#F3E5F5',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'predefined-process',
      label: 'Predefined Process',
      shape: 'rectangle-double',
      default_fill: '#ECEFF1',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'document',
      label: 'Document',
      shape: 'document',
      default_fill: '#FFF8E1',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'sequence-flow',
      label: 'Sequence Flow',
      line_style: 'solid',
      arrow_type: 'forward',
      default_color: null,
      requires_label: false,
    },
  ],
  connection_rules: [
    {
      source_type: '*',
      target_type: '*',
      allowed_edge_types: ['sequence-flow'],
      min_outgoing: null,
      max_outgoing: null,
      min_incoming: null,
      max_incoming: null,
    },
  ],
  preferred_layout: 'hierarchical',
};

export const flowchartNotationHandler: ConceptHandler = {
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

export default flowchartNotationHandler;
