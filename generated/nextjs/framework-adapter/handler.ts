// FrameworkAdapter — Framework integration adapter: translates concept operations into
// framework-native rendering, manages adapter lifecycle (register/mount/render/unmount).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FrameworkAdapterStorage,
  FrameworkAdapterRegisterInput,
  FrameworkAdapterRegisterOutput,
  FrameworkAdapterNormalizeInput,
  FrameworkAdapterNormalizeOutput,
  FrameworkAdapterMountInput,
  FrameworkAdapterMountOutput,
  FrameworkAdapterRenderInput,
  FrameworkAdapterRenderOutput,
  FrameworkAdapterUnmountInput,
  FrameworkAdapterUnmountOutput,
} from './types.js';

import {
  registerOk,
  registerDuplicate,
  normalizeOk,
  normalizeNotfound,
  mountOk,
  mountError,
  renderOk,
  renderError,
  unmountOk,
  unmountNotfound,
} from './types.js';

export interface FrameworkAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface FrameworkAdapterHandler {
  readonly register: (
    input: FrameworkAdapterRegisterInput,
    storage: FrameworkAdapterStorage,
  ) => TE.TaskEither<FrameworkAdapterError, FrameworkAdapterRegisterOutput>;
  readonly normalize: (
    input: FrameworkAdapterNormalizeInput,
    storage: FrameworkAdapterStorage,
  ) => TE.TaskEither<FrameworkAdapterError, FrameworkAdapterNormalizeOutput>;
  readonly mount: (
    input: FrameworkAdapterMountInput,
    storage: FrameworkAdapterStorage,
  ) => TE.TaskEither<FrameworkAdapterError, FrameworkAdapterMountOutput>;
  readonly render: (
    input: FrameworkAdapterRenderInput,
    storage: FrameworkAdapterStorage,
  ) => TE.TaskEither<FrameworkAdapterError, FrameworkAdapterRenderOutput>;
  readonly unmount: (
    input: FrameworkAdapterUnmountInput,
    storage: FrameworkAdapterStorage,
  ) => TE.TaskEither<FrameworkAdapterError, FrameworkAdapterUnmountOutput>;
}

// --- Helpers ---

const toStorageError = (error: unknown): FrameworkAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const frameworkAdapterHandler: FrameworkAdapterHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('adapters', input.renderer),
        toStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              // No existing adapter -- register new one
              pipe(
                TE.tryCatch(
                  async () => {
                    await storage.put('adapters', input.renderer, {
                      renderer: input.renderer,
                      framework: input.framework,
                      version: input.version,
                      normalizer: input.normalizer,
                      mountFn: input.mountFn,
                      status: 'registered',
                      registeredAt: new Date().toISOString(),
                    });
                    return registerOk(input.renderer);
                  },
                  toStorageError,
                ),
              ),
            (rec) => {
              const existingFramework = String((rec as Record<string, unknown>).framework ?? '');
              return TE.right(registerDuplicate(
                `Adapter '${input.renderer}' already registered for framework '${existingFramework}'`,
              ) as FrameworkAdapterRegisterOutput);
            },
          ),
        ),
      ),
    ),

  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('adapters', input.renderer),
        toStorageError,
      ),
      TE.chain((adapterRecord) =>
        pipe(
          O.fromNullable(adapterRecord),
          O.fold(
            () => TE.right(normalizeNotfound(
              `Adapter '${input.renderer}' not found. Register it first.`,
            ) as FrameworkAdapterNormalizeOutput),
            (rec) => {
              const normalizer = String((rec as Record<string, unknown>).normalizer ?? '');

              // Apply the normalizer transformation to the props
              // The normalizer defines a strategy for converting concept props
              // to the framework's expected format
              const normalized = JSON.stringify({
                source: 'concept',
                normalizer,
                renderer: input.renderer,
                props: input.props,
                normalizedAt: new Date().toISOString(),
              });

              return TE.right(normalizeOk(normalized));
            },
          ),
        ),
      ),
    ),

  mount: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('adapters', input.renderer),
        toStorageError,
      ),
      TE.chain((adapterRecord) =>
        pipe(
          O.fromNullable(adapterRecord),
          O.fold(
            () => TE.right(mountError(
              `Cannot mount: adapter '${input.renderer}' not registered`,
            ) as FrameworkAdapterMountOutput),
            (rec) => {
              // Check if already mounted to this target
              return pipe(
                TE.tryCatch(
                  () => storage.get('mounts', `${input.renderer}:${input.target}`),
                  toStorageError,
                ),
                TE.chain((mountRecord) =>
                  pipe(
                    O.fromNullable(mountRecord),
                    O.fold(
                      () =>
                        pipe(
                          TE.tryCatch(
                            async () => {
                              await storage.put('mounts', `${input.renderer}:${input.target}`, {
                                renderer: input.renderer,
                                machine: input.machine,
                                target: input.target,
                                status: 'mounted',
                                mountedAt: new Date().toISOString(),
                              });
                              return mountOk(input.renderer);
                            },
                            toStorageError,
                          ),
                        ),
                      () => TE.right(mountError(
                        `Adapter '${input.renderer}' is already mounted to target '${input.target}'`,
                      ) as FrameworkAdapterMountOutput),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  render: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('adapters', input.adapter),
        toStorageError,
      ),
      TE.chain((adapterRecord) =>
        pipe(
          O.fromNullable(adapterRecord),
          O.fold(
            () => TE.right(renderError(
              `Adapter '${input.adapter}' not found`,
            ) as FrameworkAdapterRenderOutput),
            (rec) => {
              const status = String((rec as Record<string, unknown>).status ?? '');

              // Verify the adapter is in a mounted state
              return pipe(
                TE.tryCatch(
                  () => storage.find('mounts', { renderer: input.adapter }),
                  toStorageError,
                ),
                TE.chain((mounts) => {
                  if (mounts.length === 0) {
                    return TE.right(renderError(
                      `Adapter '${input.adapter}' is registered but not mounted to any target`,
                    ) as FrameworkAdapterRenderOutput);
                  }

                  return pipe(
                    TE.tryCatch(
                      async () => {
                        // Record the render invocation
                        await storage.put('renders', `${input.adapter}:${Date.now()}`, {
                          adapter: input.adapter,
                          props: input.props,
                          renderedAt: new Date().toISOString(),
                        });
                        return renderOk(input.adapter);
                      },
                      toStorageError,
                    ),
                  );
                }),
              );
            },
          ),
        ),
      ),
    ),

  unmount: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('mounts', { renderer: input.renderer }),
        toStorageError,
      ),
      TE.chain((mounts) => {
        // Find the mount matching both renderer and target
        const matching = mounts.filter(
          (m) => {
            const rec = m as Record<string, unknown>;
            return String(rec.renderer ?? '') === input.renderer &&
              String(rec.target ?? '') === input.target;
          },
        );

        if (matching.length === 0) {
          return TE.right(unmountNotfound(
            `No mount found for adapter '${input.renderer}' on target '${input.target}'`,
          ) as FrameworkAdapterUnmountOutput);
        }

        return pipe(
          TE.tryCatch(
            async () => {
              await storage.delete('mounts', `${input.renderer}:${input.target}`);
              return unmountOk(input.renderer);
            },
            toStorageError,
          ),
        );
      }),
    ),
};
