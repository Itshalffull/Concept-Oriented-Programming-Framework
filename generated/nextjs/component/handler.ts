import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ComponentStorage, ComponentRegisterInput, ComponentRegisterOutput, ComponentPlaceInput, ComponentPlaceOutput, ComponentRenderInput, ComponentRenderOutput } from './types.js';
import { registerOk, placeOk, renderOk } from './types.js';

export interface ComponentError { readonly code: string; readonly message: string; }
export interface ComponentHandler {
  readonly register: (input: ComponentRegisterInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentRegisterOutput>;
  readonly place: (input: ComponentPlaceInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentPlaceOutput>;
  readonly render: (input: ComponentRenderInput, storage: ComponentStorage) => TE.TaskEither<ComponentError, ComponentRenderOutput>;
}

const err = (error: unknown): ComponentError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const componentHandler: ComponentHandler = {
  register: (input, storage) => pipe(TE.tryCatch(async () => {
    await storage.put('components', input.component, { component: input.component, config: input.config });
    return registerOk();
  }, err)),
  place: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('components', input.component);
    if (record) {
      await storage.put('components', input.component, { ...record, region: input.region });
    }
    return placeOk();
  }, err)),
  render: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('components', input.component);
    const config = record ? String(record.config ?? '') : '';
    const region = record ? String(record.region ?? '') : '';
    const output = `${config}:${region}:${input.context}`;
    return renderOk(output);
  }, err)),
};
