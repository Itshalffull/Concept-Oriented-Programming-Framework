// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// CausalLoopNotation Handler
//
// Notation provider for causal loop (system dynamics) diagrams.
// Defines a single variable node type connected by positive
// (reinforcing) and negative (balancing) influence edges,
// laid out in a circular arrangement.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const NOTATION_NAME = 'causal-loop';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Causal loop diagram notation with variable nodes connected by positive (reinforcing) and negative (balancing) influence edges.',
  node_types: [
    { type_key: 'variable', label: 'Variable', shape: 'rectangle', default_fill: '#E3F2FD', default_stroke: null, icon: null, schema_id: null },
  ],
  edge_types: [
    { type_key: 'positive', label: 'Positive', line_style: 'solid', arrow_type: 'forward', default_color: '#4CAF50', requires_label: false },
    { type_key: 'negative', label: 'Negative', line_style: 'dashed', arrow_type: 'forward', default_color: '#F44336', requires_label: false },
  ],
  connection_rules: [
    { source_type: 'variable', target_type: 'variable', allowed_edge_types: ['positive', 'negative'], min_outgoing: null, max_outgoing: null, min_incoming: null, max_incoming: null },
  ],
  preferred_layout: 'circular',
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

export const causalLoopNotationHandler = autoInterpret(_handler);

export default causalLoopNotationHandler;
