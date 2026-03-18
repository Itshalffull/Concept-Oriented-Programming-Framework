// @migrated dsl-constructs 2026-03-18
// FormBuilder Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const formBuilderHandlerFunctional: FunctionalConceptHandler = {
  buildForm(input: Record<string, unknown>) {
    const form = input.form as string;
    const schema = input.schema as string;

    if (!schema) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Schema is required to build a form' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = put(p, 'formDefinition', form, {
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

    return complete(p, 'ok', { definition }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const form = input.form as string;
    const data = input.data as string;

    let p = createProgram();
    p = spGet(p, 'formDefinition', form, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'formDefinition', form, {
          validationState: JSON.stringify({ lastValidated: data, valid: true, errors: [] }),
        });
        return complete(b2, 'ok', { valid: true, errors: '' });
      },
      (b) => complete(b, 'ok', { valid: true, errors: '' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  processSubmission(input: Record<string, unknown>) {
    const form = input.form as string;
    const data = input.data as string;

    let p = createProgram();
    p = spGet(p, 'formDefinition', form, 'existing');

    const result = JSON.stringify({
      form,
      data,
      processedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { result }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerWidget(input: Record<string, unknown>) {
    const form = input.form as string;
    const type = input.type as string;
    const widget = input.widget as string;

    let p = createProgram();
    p = spGet(p, 'formDefinition', form, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'formDefinition', form, {
          widgetRegistry: JSON.stringify({ [type]: widget }),
        });
        return complete(b2, 'ok', { form });
      },
      (b) => {
        let b2 = put(b, 'formDefinition', form, {
          form,
          schema: '',
          widgetRegistry: JSON.stringify({ [type]: widget }),
          validationState: '{}',
        });
        return complete(b2, 'ok', { form });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getWidget(input: Record<string, unknown>) {
    const form = input.form as string;
    const type = input.type as string;

    let p = createProgram();
    p = spGet(p, 'formDefinition', form, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { widget: '' }),
      (b) => complete(b, 'notfound', { message: 'Form not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const formBuilderHandler = wrapFunctional(formBuilderHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { formBuilderHandlerFunctional };
