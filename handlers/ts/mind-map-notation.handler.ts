// @migrated dsl-constructs 2026-03-18
// ============================================================
// MindMapNotation Handler
//
// Notation provider for mind map diagrams. Defines central-topic,
// main-branch, and sub-branch node types connected by curved
// branch edges, laid out as a radial tree.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

const NOTATION_NAME = 'mind-map';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Mind map notation with central topic, main branches, and sub-branches connected by curved branch edges.',
  node_types: [
    {
      type_key: 'central-topic',
      label: 'Central Topic',
      shape: 'rounded-rectangle',
      default_fill: '#E3F2FD',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'main-branch',
      label: 'Main Branch',
      shape: 'rounded-rectangle',
      default_fill: '#E8F5E9',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
    {
      type_key: 'sub-branch',
      label: 'Sub Branch',
      shape: 'rectangle',
      default_fill: '#FFF3E0',
      default_stroke: null,
      icon: null,
      schema_id: null,
    },
  ],
  edge_types: [
    {
      type_key: 'branch',
      label: 'Branch',
      line_style: 'curved',
      arrow_type: 'none',
      default_color: null,
      requires_label: false,
    },
  ],
  connection_rules: [],
  preferred_layout: 'tree',
};

type Result = { variant: string; [key: string]: unknown };

const _mindMapNotationHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'notation-provider', NOTATION_NAME, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { name: NOTATION_NAME, category: 'diagram_notation' }),
      (b) => {
        let b2 = put(b, 'notation-provider', NOTATION_NAME, {
          id: NOTATION_NAME,
          name: NOTATION_NAME,
          category: 'diagram_notation',
          definition: DEFINITION,
        });
        return complete(b2, 'ok', { name: NOTATION_NAME, category: 'diagram_notation' });
      },
    );

    return p as StorageProgram<Result>;
  },

  getDefinition(_input: Record<string, unknown>) {
    let p = createProgram();
    return complete(p, 'ok', {
      notation: DEFINITION,
    }) as StorageProgram<Result>;
  },
};

export const mindMapNotationHandler = autoInterpret(_mindMapNotationHandler);

export default mindMapNotationHandler;
