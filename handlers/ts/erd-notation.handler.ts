// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ErdNotation Handler
//
// Notation provider for Entity-Relationship Diagrams (ERD).
// Defines entity, weak-entity, attribute, and relationship
// nodes connected by one-to-one, one-to-many, and many-to-many
// cardinality edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'notation-provider', NOTATION_NAME, 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'ok', { name: NOTATION_NAME, category: 'diagram_notation' }),
      (elseP) => {
        elseP = put(elseP, 'notation-provider', NOTATION_NAME, {
          id: NOTATION_NAME,
          name: NOTATION_NAME,
          category: 'diagram_notation',
          definition: DEFINITION,
        });
        return complete(elseP, 'ok', { name: NOTATION_NAME, category: 'diagram_notation' });
      },
    ) as StorageProgram<Result>;
  },

  getDefinition(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { notation: DEFINITION }) as StorageProgram<Result>;
  },
};

export const erdNotationHandler = autoInterpret(_handler);

export default erdNotationHandler;
