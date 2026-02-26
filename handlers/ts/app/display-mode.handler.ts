// DisplayMode Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const displayModeHandler: ConceptHandler = {
  async defineMode(input, storage) {
    const mode = input.mode as string;
    const name = input.name as string;

    const allModes = await storage.find('displayMode', { name });
    if (allModes.length > 0) {
      return { variant: 'exists', message: `A mode with name "${name}" already exists` };
    }

    await storage.put('displayMode', mode, {
      mode,
      name,
      fieldDisplayConfigs: '{}',
      fieldFormConfigs: '{}',
    });

    return { variant: 'ok', mode };
  },

  async configureFieldDisplay(input, storage) {
    const mode = input.mode as string;
    const field = input.field as string;
    const config = input.config as string;

    let existing = await storage.get('displayMode', mode);
    if (!existing) {
      // Auto-create mode when configuring field display
      existing = {
        mode,
        name: mode,
        fieldDisplayConfigs: '{}',
        fieldFormConfigs: '{}',
      };
      await storage.put('displayMode', mode, existing);
    }

    const configs = JSON.parse((existing.fieldDisplayConfigs as string) || '{}');
    configs[field] = config;

    await storage.put('displayMode', mode, {
      ...existing,
      fieldDisplayConfigs: JSON.stringify(configs),
    });

    return { variant: 'ok', mode };
  },

  async configureFieldForm(input, storage) {
    const mode = input.mode as string;
    const field = input.field as string;
    const config = input.config as string;

    const existing = await storage.get('displayMode', mode);
    if (!existing) {
      return { variant: 'notfound', message: 'Display mode not found' };
    }

    const configs = JSON.parse((existing.fieldFormConfigs as string) || '{}');
    configs[field] = config;

    await storage.put('displayMode', mode, {
      ...existing,
      fieldFormConfigs: JSON.stringify(configs),
    });

    return { variant: 'ok', mode };
  },

  async renderInMode(input, storage) {
    const mode = input.mode as string;
    const entity = input.entity as string;

    const existing = await storage.get('displayMode', mode);
    if (!existing) {
      return { variant: 'notfound', message: 'Display mode not found' };
    }

    const displayConfigs = JSON.parse((existing.fieldDisplayConfigs as string) || '{}');
    const output = JSON.stringify({
      entity,
      mode: existing.name,
      appliedConfigs: displayConfigs,
    });

    return { variant: 'ok', output };
  },
};
