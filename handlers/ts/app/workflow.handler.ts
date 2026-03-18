// @migrated dsl-constructs 2026-03-18
// Workflow Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const workflowHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram(); p = find(p, 'workflow', {}, 'items');
    p = mapBindings(p, (bindings) => JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []), 'itemsJson');
    return complete(p, 'ok', { items: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineState(input: Record<string, unknown>) {
    const workflow = input.workflow as string; const name = input.name as string; const flags = input.flags as string;
    let p = createProgram(); p = spGet(p, 'workflow', workflow, 'wfRecord');
    p = putFrom(p, 'workflow', workflow, (bindings) => {
      const wfRecord = (bindings.wfRecord as Record<string, unknown>) || { workflow, states: JSON.stringify([]), transitions: JSON.stringify([]), entities: JSON.stringify({}) };
      const states: Array<{ name: string; flags: string }> = JSON.parse((wfRecord.states as string) || '[]');
      if (states.some((s) => s.name === name)) return wfRecord; // exists check handled via mapBindings
      states.push({ name, flags });
      return { ...wfRecord, states: JSON.stringify(states) };
    });
    p = mapBindings(p, (bindings) => {
      const wfRecord = (bindings.wfRecord as Record<string, unknown>) || { states: '[]' };
      const states: Array<{ name: string }> = JSON.parse((wfRecord.states as string) || '[]');
      return states.some((s) => s.name === name);
    }, 'alreadyExists');
    p = branch(p, (bindings) => bindings.alreadyExists as boolean,
      (() => { let e = createProgram(); return complete(e, 'exists', { message: 'A state with this name already exists in the workflow' }); })(),
      (() => { let t = createProgram(); return complete(t, 'ok', {}); })());
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineTransition(input: Record<string, unknown>) {
    const workflow = input.workflow as string; const from = input.from as string; const to = input.to as string;
    const label = input.label as string; const guard = input.guard as string;
    let p = createProgram(); p = spGet(p, 'workflow', workflow, 'wfRecord');
    p = branch(p, 'wfRecord',
      (b) => {
        let b2 = putFrom(b, 'workflow', workflow, (bindings) => {
          const wfRecord = bindings.wfRecord as Record<string, unknown>;
          const transitions: Array<{ from: string; to: string; label: string; guard: string }> = JSON.parse((wfRecord.transitions as string) || '[]');
          transitions.push({ from, to, label, guard });
          return { ...wfRecord, transitions: JSON.stringify(transitions) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'error', { message: 'Workflow does not exist' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  transition(input: Record<string, unknown>) {
    const workflow = input.workflow as string; const entity = input.entity as string; const transitionLabel = input.transition as string;
    let p = createProgram(); p = spGet(p, 'workflow', workflow, 'wfRecord');
    p = branch(p, 'wfRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const wfRecord = bindings.wfRecord as Record<string, unknown>;
          const states: Array<{ name: string; flags: string }> = JSON.parse((wfRecord.states as string) || '[]');
          const transitions: Array<{ from: string; to: string; label: string }> = JSON.parse((wfRecord.transitions as string) || '[]');
          const entities: Record<string, string> = JSON.parse((wfRecord.entities as string) || '{}');
          let currentState = entities[entity];
          if (!currentState) { const initial = states.find((s) => s.flags.includes('initial')); if (!initial) return { error: 'No initial state defined in the workflow' }; currentState = initial.name; }
          const match = transitions.find((t) => t.from === currentState && t.label === transitionLabel);
          if (!match) return { error: `No transition "${transitionLabel}" from state "${currentState}"` };
          return { newState: match.to };
        }, 'transitionResult');
        b2 = branch(b2, (bindings) => !!(bindings.transitionResult as any).error,
          (() => { let e = createProgram(); return complete(e, 'notfound', { message: '' }); })(),
          (() => {
            let t = createProgram();
            t = putFrom(t, 'workflow', workflow, (bindings) => {
              const wfRecord = bindings.wfRecord as Record<string, unknown>;
              const entities: Record<string, string> = JSON.parse((wfRecord.entities as string) || '{}');
              const result = bindings.transitionResult as { newState: string };
              entities[entity] = result.newState;
              return { ...wfRecord, entities: JSON.stringify(entities) };
            });
            return complete(t, 'ok', { newState: '' });
          })());
        return b2;
      },
      (b) => complete(b, 'notfound', { message: 'The workflow was not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getCurrentState(input: Record<string, unknown>) {
    const workflow = input.workflow as string; const entity = input.entity as string;
    let p = createProgram(); p = spGet(p, 'workflow', workflow, 'wfRecord');
    p = branch(p, 'wfRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const wfRecord = bindings.wfRecord as Record<string, unknown>;
          const states: Array<{ name: string; flags: string }> = JSON.parse((wfRecord.states as string) || '[]');
          const entities: Record<string, string> = JSON.parse((wfRecord.entities as string) || '{}');
          let currentState = entities[entity];
          if (!currentState) { const initial = states.find((s) => s.flags.includes('initial')); if (!initial) return null; currentState = initial.name; }
          return currentState;
        }, 'state');
        b2 = branch(b2, 'state', (b3) => complete(b3, 'ok', { state: '' }),
          (b3) => complete(b3, 'notfound', { message: 'Entity not found and no initial state defined' }));
        return b2;
      },
      (b) => complete(b, 'notfound', { message: 'The workflow was not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
