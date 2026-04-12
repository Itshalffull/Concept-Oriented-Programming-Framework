// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Template Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _templateHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const template = input.template as string;
    const body = input.body as string;
    const variables = input.variables as string;
    const trigger = (input.trigger as string) || null;
    const triggerKind = (input.trigger_kind as string) || null;
    let p = createProgram();
    p = spGet(p, 'template', template, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'A template with this identity already exists' }),
      (b) => {
        let b2 = put(b, 'template', template, { template, body, variables, triggers: '[]', trigger, trigger_kind: triggerKind });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  instantiate(input: Record<string, unknown>) {
    if (!input.template || (typeof input.template === 'string' && (input.template as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'template is required' }) as StorageProgram<Result>;
    }
    const template = input.template as string;
    const values = input.values as string;
    let p = createProgram();
    p = spGet(p, 'template', template, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const body = existing.body as string;
          const pairs = values.split('&').reduce<Record<string, string>>((acc, pair) => {
            const [key, val] = pair.split('=');
            if (key) acc[key] = val ?? '';
            return acc;
          }, {});
          let content = body;
          for (const [key, val] of Object.entries(pairs)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
          }
          return content;
        }, 'content');
        return completeFrom(b2, 'ok', (bindings) => ({ content: bindings.content as string }));
      },
      (b) => complete(b, 'notfound', { message: 'Template not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerTrigger(input: Record<string, unknown>) {
    if (!input.template || (typeof input.template === 'string' && (input.template as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'template is required' }) as StorageProgram<Result>;
    }
    if (!input.trigger || (typeof input.trigger === 'string' && (input.trigger as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'trigger is required' }) as StorageProgram<Result>;
    }
    const template = input.template as string;
    const trigger = input.trigger as string;
    let p = createProgram();
    p = spGet(p, 'template', template, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'template', template, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const triggers = JSON.parse((existing.triggers as string) || '[]') as string[];
          triggers.push(trigger);
          return { ...existing, triggers: JSON.stringify(triggers) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Template not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  mergeProperties(input: Record<string, unknown>) {
    if (!input.template || (typeof input.template === 'string' && (input.template as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'template is required' }) as StorageProgram<Result>;
    }
    const template = input.template as string;
    const properties = input.properties as string;
    let p = createProgram();
    p = spGet(p, 'template', template, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'template', template, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const currentVariables = existing.variables as string;
          const merged = currentVariables ? `${currentVariables},${properties}` : properties;
          return { ...existing, variables: merged };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Template not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const templateHandler = autoInterpret(_templateHandler);

