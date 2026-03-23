// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// FlowchartNotation Handler
//
// Notation provider for standard flowchart diagrams. Defines
// process, decision, terminal, data, predefined-process, and
// document node types with sequence-flow edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

export const flowchartNotationHandler = autoInterpret(_handler);

export default flowchartNotationHandler;
