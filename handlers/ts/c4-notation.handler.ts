// @migrated dsl-constructs 2026-03-18
// ============================================================
// C4Notation Handler
//
// Notation provider for C4 model architecture diagrams. Defines
// person, system, container, component, and external-system
// nodes connected by labeled relationship edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const NOTATION_NAME = 'c4';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'C4 model notation with person, system, container, component, and external-system nodes connected by labeled relationship edges.',
  node_types: [
    { type_key: 'person', label: 'Person', shape: 'person-shape', default_fill: '#08427B', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'system', label: 'System', shape: 'rectangle', default_fill: '#1168BD', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'container', label: 'Container', shape: 'rectangle', default_fill: '#438DD5', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'component', label: 'Component', shape: 'rectangle', default_fill: '#85BBF0', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'external-system', label: 'External System', shape: 'rectangle', default_fill: '#999999', default_stroke: null, icon: null, schema_id: null },
  ],
  edge_types: [
    { type_key: 'relationship', label: 'Relationship', line_style: 'solid', arrow_type: 'forward', default_color: null, requires_label: true },
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
    return complete(p, 'ok', { notation: DEFINITION }) as StorageProgram<Result>;
  },
};

export const c4NotationHandler = autoInterpret(_handler);

export default c4NotationHandler;
