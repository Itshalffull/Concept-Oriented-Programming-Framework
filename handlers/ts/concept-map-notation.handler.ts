// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptMapNotation Handler
//
// Notation provider for concept map diagrams. Defines concept
// and linking-phrase node types connected by labeled proposition
// edges, laid out with force-directed positioning.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const NOTATION_NAME = 'concept-map';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Concept map notation with concept nodes and linking phrases connected by labeled proposition edges.',
  node_types: [
    { type_key: 'concept', label: 'Concept', shape: 'rounded-rectangle', default_fill: '#E3F2FD', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'linking-phrase', label: 'Linking Phrase', shape: 'rectangle-small', default_fill: '#FFF9C4', default_stroke: null, icon: null, schema_id: null },
  ],
  edge_types: [
    { type_key: 'proposition', label: 'Proposition', line_style: 'solid', arrow_type: 'forward', default_color: null, requires_label: true },
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

export const conceptMapNotationHandler = autoInterpret(_handler);

export default conceptMapNotationHandler;
