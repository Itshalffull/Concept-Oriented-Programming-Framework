import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ComponentStorage, ComponentRegisterInput, ComponentRegisterOutput, ComponentPlaceInput, ComponentPlaceOutput, ComponentRenderInput, ComponentRenderOutput, ComponentSetVisibilityInput, ComponentSetVisibilityOutput, ComponentEvaluateVisibilityInput, ComponentEvaluateVisibilityOutput } from './types.js';
import { registerOk, registerExists, placeOk, placeNotfound, renderOk, renderNotfound, setVisibilityOk, setVisibilityNotfound, evaluateVisibilityOk, evaluateVisibilityNotfound } from './types.js';

export interface ComponentError { readonly code: string; readonly message: string; }
export interface ComponentHandler {
  readonly register: (input: ComponentRegisterInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentRegisterOutput>;
  readonly place: (input: ComponentPlaceInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentPlaceOutput>;
  readonly render: (input: ComponentRenderInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentRenderOutput>;
  readonly setVisibility: (input: ComponentSetVisibilityInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentSetVisibilityOutput>;
  readonly evaluateVisibility: (input: ComponentEvaluateVisibilityInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentEvaluateVisibilityOutput>;
}

const err = (error: unknown): ComponentError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const componentHandler: ComponentHandler = {
  register: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('components', input.component);
    if (existing) return registerExists(`Component ${input.component} already exists`);
    await storage.put('components', input.component, { component: input.component, config: input.config, visible: true });
    return registerOk();
  }, err)),
  place: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('components', input.component);
    if (!record) return placeNotfound(`Component ${input.component} not found`);
    await storage.put('components', input.component, { ...record, region: input.region });
    return placeOk();
  }, err)),
  render: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('components', input.component);
    if (!record) return renderNotfound(`Component ${input.component} not found`);
    const configStr = String(record.config ?? '');
    let isJsonConfig = false;
    let config: unknown = configStr;
    try { config = JSON.parse(configStr); isJsonConfig = true; } catch { /* plain string */ }
    let isJsonContext = false;
    let context: unknown = input.context;
    try { context = JSON.parse(input.context); isJsonContext = true; } catch { /* plain string */ }
    let output: string;
    if (isJsonConfig && isJsonContext) {
      output = JSON.stringify({ rendered: true, component: input.component, config, context });
    } else {
      const region = record.region ? String(record.region) : '';
      output = `${configStr}:${region}:${input.context}`;
    }
    return renderOk(output);
  }, err)),
  setVisibility: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('components', input.component);
    if (!record) return setVisibilityNotfound(`Component ${input.component} not found`);
    await storage.put('components', input.component, { ...record, visible: input.visible });
    return setVisibilityOk();
  }, err)),
  evaluateVisibility: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('components', input.component);
    if (!record) return evaluateVisibilityNotfound(`Component ${input.component} not found`);
    const visible = record.visible !== false;
    return evaluateVisibilityOk(visible);
  }, err)),
};
