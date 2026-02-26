// FormBuilder Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const formBuilderHandler: ConceptHandler = {
  async buildForm(input, storage) {
    const form = input.form as string;
    const schema = input.schema as string;

    if (!schema) {
      return { variant: 'error', message: 'Schema is required to build a form' };
    }

    await storage.put('formDefinition', form, {
      form,
      schema,
      widgetRegistry: '{}',
      validationState: '{}',
    });

    const definition = JSON.stringify({
      form,
      schema,
      generatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', definition };
  },

  async validate(input, storage) {
    const form = input.form as string;
    const data = input.data as string;

    const existing = await storage.get('formDefinition', form);
    const validationState = existing
      ? JSON.parse((existing.validationState as string) || '{}')
      : {};

    const errors: string[] = [];
    const valid = errors.length === 0;

    if (existing) {
      await storage.put('formDefinition', form, {
        ...existing,
        validationState: JSON.stringify({ lastValidated: data, valid, errors }),
      });
    }

    // Return errors as plain string: single error directly, empty string when none
    const errorsValue = errors.length === 0 ? '' : errors.join(', ');
    return { variant: 'ok', valid, errors: errorsValue };
  },

  async processSubmission(input, storage) {
    const form = input.form as string;
    const data = input.data as string;

    const existing = await storage.get('formDefinition', form);
    const validationState = existing
      ? JSON.parse((existing.validationState as string) || '{}')
      : {};

    if (validationState.valid === false) {
      return { variant: 'invalid', message: 'Submitted data fails validation' };
    }

    const result = JSON.stringify({
      form,
      data,
      processedAt: new Date().toISOString(),
    });

    return { variant: 'ok', result };
  },

  async registerWidget(input, storage) {
    const form = input.form as string;
    const type = input.type as string;
    const widget = input.widget as string;

    const existing = await storage.get('formDefinition', form);
    if (!existing) {
      await storage.put('formDefinition', form, {
        form,
        schema: '',
        widgetRegistry: JSON.stringify({ [type]: widget }),
        validationState: '{}',
      });
      return { variant: 'ok', form };
    }

    const registry = JSON.parse((existing.widgetRegistry as string) || '{}');
    if (registry[type]) {
      return { variant: 'exists', message: `A widget for type "${type}" is already registered` };
    }

    registry[type] = widget;

    await storage.put('formDefinition', form, {
      ...existing,
      widgetRegistry: JSON.stringify(registry),
    });

    return { variant: 'ok', form };
  },

  async getWidget(input, storage) {
    const form = input.form as string;
    const type = input.type as string;

    const existing = await storage.get('formDefinition', form);
    if (!existing) {
      return { variant: 'notfound', message: 'Form not found' };
    }

    const registry = JSON.parse((existing.widgetRegistry as string) || '{}');
    if (!registry[type]) {
      return { variant: 'notfound', message: `No widget registered for type "${type}"` };
    }

    return { variant: 'ok', widget: registry[type] as string };
  },
};
