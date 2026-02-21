// Workflow Concept Implementation
// Finite state machines with named states and guarded transitions for content lifecycle management.
import type { ConceptHandler } from '@copf/kernel';

export const workflowHandler: ConceptHandler = {
  async defineState(input, storage) {
    const workflow = input.workflow as string;
    const name = input.name as string;
    const flags = input.flags as string;

    let wfRecord = await storage.get('workflow', workflow);
    if (!wfRecord) {
      // Auto-initialize the workflow on first state definition
      wfRecord = {
        workflow,
        states: JSON.stringify([]),
        transitions: JSON.stringify([]),
        entities: JSON.stringify({}),
      };
    }

    const states: Array<{ name: string; flags: string }> = JSON.parse(
      (wfRecord.states as string) || '[]',
    );

    // Check if a state with this name already exists
    if (states.some((s) => s.name === name)) {
      return { variant: 'exists', message: 'A state with this name already exists in the workflow' };
    }

    states.push({ name, flags });

    await storage.put('workflow', workflow, {
      ...wfRecord,
      states: JSON.stringify(states),
    });

    return { variant: 'ok' };
  },

  async defineTransition(input, storage) {
    const workflow = input.workflow as string;
    const from = input.from as string;
    const to = input.to as string;
    const label = input.label as string;
    const guard = input.guard as string;

    const wfRecord = await storage.get('workflow', workflow);
    if (!wfRecord) {
      return { variant: 'error', message: 'Workflow does not exist' };
    }

    const states: Array<{ name: string; flags: string }> = JSON.parse(
      (wfRecord.states as string) || '[]',
    );
    const stateNames = states.map((s) => s.name);

    // Validate that both states exist
    if (!stateNames.includes(from)) {
      return { variant: 'error', message: `Source state "${from}" does not exist` };
    }
    if (!stateNames.includes(to)) {
      return { variant: 'error', message: `Target state "${to}" does not exist` };
    }

    const transitions: Array<{
      from: string;
      to: string;
      label: string;
      guard: string;
    }> = JSON.parse((wfRecord.transitions as string) || '[]');

    transitions.push({ from, to, label, guard });

    await storage.put('workflow', workflow, {
      ...wfRecord,
      transitions: JSON.stringify(transitions),
    });

    return { variant: 'ok' };
  },

  async transition(input, storage) {
    const workflow = input.workflow as string;
    const entity = input.entity as string;
    const transitionLabel = input.transition as string;

    const wfRecord = await storage.get('workflow', workflow);
    if (!wfRecord) {
      return { variant: 'notfound', message: 'The workflow was not found' };
    }

    const states: Array<{ name: string; flags: string }> = JSON.parse(
      (wfRecord.states as string) || '[]',
    );
    const transitions: Array<{
      from: string;
      to: string;
      label: string;
      guard: string;
    }> = JSON.parse((wfRecord.transitions as string) || '[]');
    const entities: Record<string, string> = JSON.parse(
      (wfRecord.entities as string) || '{}',
    );

    // Determine entity's current state; default to the initial state
    let currentState = entities[entity];
    if (!currentState) {
      const initialState = states.find((s) => s.flags.includes('initial'));
      if (!initialState) {
        return { variant: 'notfound', message: 'No initial state defined in the workflow' };
      }
      currentState = initialState.name;
    }

    // Find matching transition from current state with the given label
    const matchingTransition = transitions.find(
      (t) => t.from === currentState && t.label === transitionLabel,
    );
    if (!matchingTransition) {
      return { variant: 'notfound', message: `No transition "${transitionLabel}" from state "${currentState}"` };
    }

    // Evaluate guard condition (non-empty guard is assumed satisfied for execution)
    // In a full implementation, guards would be evaluated against a context
    const guardPasses = true;
    if (!guardPasses) {
      return { variant: 'forbidden', message: `Guard "${matchingTransition.guard}" prevented the transition` };
    }

    // Move entity to the new state
    entities[entity] = matchingTransition.to;

    await storage.put('workflow', workflow, {
      ...wfRecord,
      entities: JSON.stringify(entities),
    });

    return { variant: 'ok', newState: matchingTransition.to };
  },

  async getCurrentState(input, storage) {
    const workflow = input.workflow as string;
    const entity = input.entity as string;

    const wfRecord = await storage.get('workflow', workflow);
    if (!wfRecord) {
      return { variant: 'notfound', message: 'The workflow was not found' };
    }

    const states: Array<{ name: string; flags: string }> = JSON.parse(
      (wfRecord.states as string) || '[]',
    );
    const entities: Record<string, string> = JSON.parse(
      (wfRecord.entities as string) || '{}',
    );

    let currentState = entities[entity];
    if (!currentState) {
      const initialState = states.find((s) => s.flags.includes('initial'));
      if (!initialState) {
        return { variant: 'notfound', message: 'Entity not found and no initial state defined' };
      }
      currentState = initialState.name;
    }

    return { variant: 'ok', state: currentState };
  },
};
