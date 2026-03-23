// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// StatechartNotation Handler
//
// Notation provider for statechart (state machine) diagrams.
// Defines state, initial, final, and composite-state nodes
// connected by labeled transition edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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
    return complete(p, 'ok', {
      notation: DEFINITION,
    }) as StorageProgram<Result>;
  },
};

export const statechartNotationHandler = autoInterpret(_handler);

export default statechartNotationHandler;
