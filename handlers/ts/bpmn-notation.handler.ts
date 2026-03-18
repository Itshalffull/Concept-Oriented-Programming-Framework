// @migrated dsl-constructs 2026-03-18
// ============================================================
// BpmnNotation Handler
//
// Notation provider for Business Process Model and Notation
// (BPMN) diagrams. Defines events, tasks, gateways, subprocesses,
// pools, and lanes with sequence, message, and association flows.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const NOTATION_NAME = 'bpmn';

const DEFINITION = {
  name: NOTATION_NAME,
  description: 'Business Process Model and Notation (BPMN) with events, tasks, gateways, subprocesses, pools, and lanes.',
  node_types: [
    { type_key: 'start-event', label: 'Start Event', shape: 'circle', default_fill: '#E8F5E9', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'end-event', label: 'End Event', shape: 'circle-bold', default_fill: '#FFEBEE', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'intermediate-event', label: 'Intermediate Event', shape: 'circle-double', default_fill: '#FFF3E0', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'task', label: 'Task', shape: 'rectangle', default_fill: '#E3F2FD', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'user-task', label: 'User Task', shape: 'rectangle', default_fill: '#E3F2FD', default_stroke: null, icon: 'person', schema_id: null },
    { type_key: 'service-task', label: 'Service Task', shape: 'rectangle', default_fill: '#E3F2FD', default_stroke: null, icon: 'gear', schema_id: null },
    { type_key: 'exclusive-gateway', label: 'Exclusive Gateway', shape: 'diamond', default_fill: '#FFF3E0', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'parallel-gateway', label: 'Parallel Gateway', shape: 'diamond', default_fill: '#FFF3E0', default_stroke: null, icon: 'plus', schema_id: null },
    { type_key: 'inclusive-gateway', label: 'Inclusive Gateway', shape: 'diamond', default_fill: '#FFF3E0', default_stroke: null, icon: 'circle', schema_id: null },
    { type_key: 'subprocess', label: 'Subprocess', shape: 'rectangle-expand', default_fill: '#E0F7FA', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'pool', label: 'Pool', shape: 'rectangle-lane', default_fill: '#FAFAFA', default_stroke: null, icon: null, schema_id: null },
    { type_key: 'lane', label: 'Lane', shape: 'rectangle-lane', default_fill: '#FFFFFF', default_stroke: null, icon: null, schema_id: null },
  ],
  edge_types: [
    { type_key: 'sequence-flow', label: 'Sequence Flow', line_style: 'solid', arrow_type: 'forward', default_color: null, requires_label: false },
    { type_key: 'message-flow', label: 'Message Flow', line_style: 'dashed', arrow_type: 'forward', default_color: null, requires_label: false },
    { type_key: 'association', label: 'Association', line_style: 'dotted', arrow_type: 'none', default_color: null, requires_label: false },
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

export const bpmnNotationHandler = autoInterpret(_handler);

export default bpmnNotationHandler;
