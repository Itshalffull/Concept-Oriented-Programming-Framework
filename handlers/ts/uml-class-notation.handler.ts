// ============================================================
// UmlClassNotation Handler
//
// Notation provider for UML class diagrams. Defines class,
// interface, abstract-class, and enum compartment nodes with
// association, aggregation, composition, inheritance,
// implementation, and dependency edge types.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const NOTATION_NAME = 'uml-class';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'UML class diagram notation with class, interface, abstract-class, and enum nodes connected by association, aggregation, composition, inheritance, implementation, and dependency edges.',
  node_types: [
    {
      type_key: 'class',
      label: 'Class',
      shape: 'rectangle-compartment',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'interface',
      label: 'Interface',
      shape: 'rectangle-compartment',
      default_fill: '#F3E5F5',
      default_stroke: null,
      icon: 'I',
      schema_id: null,
    },
    {
      type_key: 'abstract-class',
      label: 'Abstract Class',
      shape: 'rectangle-compartment',
      default_fill: '#FFF3E0',
      default_stroke: null,
      icon: 'A',
      schema_id: null,
    },
    {
      type_key: 'enum',
      label: 'Enum',
      shape: 'rectangle-compartment',
      default_fill: '#E8F5E9',
      default_stroke: null,
      icon: 'E',
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'association',
      label: 'Association',
      line_style: 'solid',
      arrow_type: 'forward',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'aggregation',
      label: 'Aggregation',
      line_style: 'solid',
      arrow_type: 'diamond-open',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'composition',
      label: 'Composition',
      line_style: 'solid',
      arrow_type: 'diamond-filled',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'inheritance',
      label: 'Inheritance',
      line_style: 'solid',
      arrow_type: 'triangle-open',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'implementation',
      label: 'Implementation',
      line_style: 'dashed',
      arrow_type: 'triangle-open',
      default_color: null,
      requires_label: false,
    },
    {
      type_key: 'dependency',
      label: 'Dependency',
      line_style: 'dashed',
      arrow_type: 'forward',
      default_color: null,
      requires_label: false,
    },
  ],
  connection_rules: [],
  preferred_layout: 'hierarchical',
};

export const umlClassNotationHandler: ConceptHandler = {
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

export default umlClassNotationHandler;
