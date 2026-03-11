// ComponentMapping — Admin-configured bindings between entity data and widget slots and props.
// Provides the manual override path for entity rendering when automatic WidgetResolver
// resolution is insufficient.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ComponentMappingStorage,
  ComponentMappingCreateInput,
  ComponentMappingCreateOutput,
  ComponentMappingBindSlotInput,
  ComponentMappingBindSlotOutput,
  ComponentMappingBindPropInput,
  ComponentMappingBindPropOutput,
  ComponentMappingRenderInput,
  ComponentMappingRenderOutput,
  ComponentMappingPreviewInput,
  ComponentMappingPreviewOutput,
  ComponentMappingLookupInput,
  ComponentMappingLookupOutput,
  ComponentMappingDeleteInput,
  ComponentMappingDeleteOutput,
} from './types.js';

import {
  createOk,
  createInvalid,
  bindSlotOk,
  bindSlotNotfound,
  bindPropOk,
  bindPropNotfound,
  renderOk,
  renderNotfound,
  previewOk,
  previewNotfound,
  lookupOk,
  lookupNotfound,
  deleteOk,
  deleteNotfound,
} from './types.js';

export interface ComponentMappingError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ComponentMappingError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ComponentMappingHandler {
  readonly create: (
    input: ComponentMappingCreateInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingCreateOutput>;
  readonly bindSlot: (
    input: ComponentMappingBindSlotInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingBindSlotOutput>;
  readonly bindProp: (
    input: ComponentMappingBindPropInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingBindPropOutput>;
  readonly render: (
    input: ComponentMappingRenderInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingRenderOutput>;
  readonly preview: (
    input: ComponentMappingPreviewInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingPreviewOutput>;
  readonly lookup: (
    input: ComponentMappingLookupInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingLookupOutput>;
  readonly delete: (
    input: ComponentMappingDeleteInput,
    storage: ComponentMappingStorage,
  ) => TE.TaskEither<ComponentMappingError, ComponentMappingDeleteOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export const componentMappingHandler: ComponentMappingHandler = {
  create: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!inp.name || !inp.widget_id) {
          return TE.right(createInvalid('Name and widget_id are required.'));
        }

        return pipe(
          TE.tryCatch(
            () => storage.find('mapping', {}),
            toStorageError,
          ),
          TE.chain((existing) => {
            const duplicate = existing.find(
              (m) => m.schema === inp.schema && m.display_mode === inp.display_mode,
            );
            if (duplicate) {
              return TE.right(
                createInvalid(`A mapping already exists for ${inp.schema}+${inp.display_mode}.`),
              );
            }

            const id = nextId('mapping');
            return TE.tryCatch(
              async () => {
                await storage.put('mapping', id, {
                  id,
                  name: inp.name,
                  widget_id: inp.widget_id,
                  widget_variant: null,
                  schema: inp.schema || null,
                  display_mode: inp.display_mode || null,
                });
                return createOk(id);
              },
              toStorageError,
            );
          }),
        );
      }),
    ),

  bindSlot: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mapping', input.mapping),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                bindSlotNotfound(`Mapping '${input.mapping}' does not exist.`),
              ),
            () => {
              const slotId = nextId('slot');
              return TE.tryCatch(
                async () => {
                  await storage.put('slot_binding', slotId, {
                    id: slotId,
                    mapping_id: input.mapping,
                    slot_name: input.slot_name,
                    sources: input.sources || [],
                  });
                  return bindSlotOk();
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  bindProp: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mapping', input.mapping),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                bindPropNotfound(`Mapping '${input.mapping}' does not exist.`),
              ),
            () => {
              const propId = nextId('prop');
              return TE.tryCatch(
                async () => {
                  await storage.put('prop_binding', propId, {
                    id: propId,
                    mapping_id: input.mapping,
                    prop_name: input.prop_name,
                    source: input.source || '',
                  });
                  return bindPropOk();
                },
                toStorageError,
              );
            },
          ),
        ),
      ),
    ),

  render: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mapping', input.mapping),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                renderNotfound(`Mapping '${input.mapping}' does not exist.`),
              ),
            (mapping) =>
              pipe(
                TE.tryCatch(
                  () => storage.find('slot_binding', {}),
                  toStorageError,
                ),
                TE.chain((allSlots) =>
                  pipe(
                    TE.tryCatch(
                      () => storage.find('prop_binding', {}),
                      toStorageError,
                    ),
                    TE.map((allProps) => {
                      const slots = allSlots.filter(
                        (s) => s.mapping_id === input.mapping,
                      );
                      const props = allProps.filter(
                        (p) => p.mapping_id === input.mapping,
                      );
                      const renderTree = JSON.stringify({
                        widget_id: mapping.widget_id,
                        widget_variant: mapping.widget_variant,
                        context: input.context,
                        slots: slots.map((s) => ({
                          name: s.slot_name,
                          sources: s.sources,
                        })),
                        props: props.map((p) => ({
                          name: p.prop_name,
                          source: p.source,
                        })),
                      });
                      return renderOk(renderTree);
                    }),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mapping', input.mapping),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                previewNotfound(`Mapping '${input.mapping}' does not exist.`),
              ),
            (mapping) =>
              pipe(
                TE.tryCatch(
                  () => storage.find('slot_binding', {}),
                  toStorageError,
                ),
                TE.chain((allSlots) =>
                  pipe(
                    TE.tryCatch(
                      () => storage.find('prop_binding', {}),
                      toStorageError,
                    ),
                    TE.map((allProps) => {
                      const slots = allSlots.filter(
                        (s) => s.mapping_id === input.mapping,
                      );
                      const props = allProps.filter(
                        (p) => p.mapping_id === input.mapping,
                      );
                      const renderTree = JSON.stringify({
                        widget_id: mapping.widget_id,
                        widget_variant: mapping.widget_variant,
                        context: JSON.stringify({ entity_id: input.entity_id }),
                        slots: slots.map((s) => ({
                          name: s.slot_name,
                          sources: s.sources,
                        })),
                        props: props.map((p) => ({
                          name: p.prop_name,
                          source: p.source,
                        })),
                      });
                      return previewOk(renderTree);
                    }),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  lookup: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('mapping', {}),
        toStorageError,
      ),
      TE.map((all) => {
        const found = all.find(
          (m) => m.schema === input.schema && m.display_mode === input.display_mode,
        );
        if (!found) {
          return lookupNotfound();
        }
        return lookupOk(found.id as string);
      }),
    ),

  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mapping', input.mapping),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deleteNotfound(`Mapping '${input.mapping}' does not exist.`),
              ),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.find('slot_binding', {}),
                  toStorageError,
                ),
                TE.chain((allSlots) =>
                  TE.tryCatch(
                    async () => {
                      // Delete slot bindings for this mapping
                      for (const slot of allSlots) {
                        if (slot.mapping_id === input.mapping) {
                          await storage.delete('slot_binding', slot.id as string);
                        }
                      }
                      // Delete prop bindings for this mapping
                      const allProps = await storage.find('prop_binding', {});
                      for (const prop of allProps) {
                        if (prop.mapping_id === input.mapping) {
                          await storage.delete('prop_binding', prop.id as string);
                        }
                      }
                      // Delete the mapping itself
                      await storage.delete('mapping', input.mapping);
                      return deleteOk();
                    },
                    toStorageError,
                  ),
                ),
              ),
          ),
        ),
      ),
    ),
};
