// Control Concept Implementation
// Bind interactive elements (buttons, sliders, toggles) to data values and actions,
// enabling direct manipulation in content.
import type { ConceptHandler } from '@clef/kernel';

export const controlHandler: ConceptHandler = {
  async create(input, storage) {
    const control = input.control as string;
    const type = input.type as string;
    const binding = input.binding as string;

    const existing = await storage.get('control', control);
    if (existing) {
      return { variant: 'exists', message: 'A control with this identity already exists' };
    }

    await storage.put('control', control, {
      control,
      type,
      value: '',
      binding,
      action: '',
    });

    return { variant: 'ok' };
  },

  async interact(input, storage) {
    const control = input.control as string;
    const interactionInput = input.input as string;

    const existing = await storage.get('control', control);
    if (!existing) {
      return { variant: 'notfound', message: 'The control was not found' };
    }

    const type = existing.type as string;
    const binding = existing.binding as string;

    // Process the interaction based on control type and update value
    await storage.put('control', control, {
      ...existing,
      value: interactionInput,
    });

    const result = `${type}:${binding}:${interactionInput}`;

    return { variant: 'ok', result };
  },

  async getValue(input, storage) {
    const control = input.control as string;

    const existing = await storage.get('control', control);
    if (!existing) {
      return { variant: 'notfound', message: 'The control was not found' };
    }

    const value = existing.value as string;

    return { variant: 'ok', value };
  },

  async setValue(input, storage) {
    const control = input.control as string;
    const value = input.value as string;

    const existing = await storage.get('control', control);
    if (!existing) {
      return { variant: 'notfound', message: 'The control was not found' };
    }

    await storage.put('control', control, {
      ...existing,
      value,
    });

    return { variant: 'ok' };
  },

  async triggerAction(input, storage) {
    const control = input.control as string;

    const existing = await storage.get('control', control);
    if (!existing) {
      return { variant: 'notfound', message: 'The control was not found' };
    }

    const type = existing.type as string;
    const binding = existing.binding as string;
    const action = existing.action as string;
    const value = existing.value as string;

    // Execute the bound action and return result
    const result = `${type}:${binding}:${action}:${value}`;

    return { variant: 'ok', result };
  },
};
