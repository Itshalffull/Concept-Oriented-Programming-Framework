// Surface — surface container for UI composition, widget attachment, and layout slot management.
// Creates rendering surfaces (dom, canvas, native), attaches framework renderers,
// manages mount zones for widget trees, and handles surface lifecycle (resize, unmount, destroy).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SurfaceStorage,
  SurfaceCreateInput,
  SurfaceCreateOutput,
  SurfaceAttachInput,
  SurfaceAttachOutput,
  SurfaceResizeInput,
  SurfaceResizeOutput,
  SurfaceMountInput,
  SurfaceMountOutput,
  SurfaceUnmountInput,
  SurfaceUnmountOutput,
  SurfaceDestroyInput,
  SurfaceDestroyOutput,
} from './types.js';

import {
  createOk,
  createUnsupported,
  attachOk,
  attachIncompatible,
  resizeOk,
  resizeNotfound,
  mountOk,
  mountError,
  mountNotfound,
  unmountOk,
  unmountNotfound,
  destroyOk,
  destroyNotfound,
} from './types.js';

export interface SurfaceError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): SurfaceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_KINDS = ['dom', 'canvas', 'native', 'terminal', 'webgl'] as const;

/** Map of surface kinds to their compatible renderers. */
const RENDERER_COMPAT: Record<string, readonly string[]> = {
  dom: ['react', 'vue', 'svelte', 'solid', 'vanilla', 'angular'],
  canvas: ['canvas2d', 'pixi', 'fabric'],
  native: ['react-native', 'flutter', 'swiftui', 'compose'],
  terminal: ['ink', 'blessed'],
  webgl: ['three', 'babylon'],
};

export interface SurfaceHandler {
  readonly create: (
    input: SurfaceCreateInput,
    storage: SurfaceStorage,
  ) => TE.TaskEither<SurfaceError, SurfaceCreateOutput>;
  readonly attach: (
    input: SurfaceAttachInput,
    storage: SurfaceStorage,
  ) => TE.TaskEither<SurfaceError, SurfaceAttachOutput>;
  readonly resize: (
    input: SurfaceResizeInput,
    storage: SurfaceStorage,
  ) => TE.TaskEither<SurfaceError, SurfaceResizeOutput>;
  readonly mount: (
    input: SurfaceMountInput,
    storage: SurfaceStorage,
  ) => TE.TaskEither<SurfaceError, SurfaceMountOutput>;
  readonly unmount: (
    input: SurfaceUnmountInput,
    storage: SurfaceStorage,
  ) => TE.TaskEither<SurfaceError, SurfaceUnmountOutput>;
  readonly destroy: (
    input: SurfaceDestroyInput,
    storage: SurfaceStorage,
  ) => TE.TaskEither<SurfaceError, SurfaceDestroyOutput>;
}

// --- Implementation ---

export const surfaceHandler: SurfaceHandler = {
  create: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!(VALID_KINDS as readonly string[]).includes(inp.kind)) {
          return TE.right(
            createUnsupported(
              `Surface kind '${inp.kind}' is not supported. Use one of: ${VALID_KINDS.join(', ')}`,
            ),
          );
        }
        return TE.tryCatch(
          async () => {
            const mountPoint = pipe(inp.mountPoint, O.getOrElse(() => 'root'));
            await storage.put('surface', inp.surface, {
              surface: inp.surface,
              kind: inp.kind,
              mountPoint,
              renderer: null,
              width: 0,
              height: 0,
              zones: {},
              status: 'created',
            });
            return createOk(inp.surface);
          },
          storageErr,
        );
      }),
    ),

  attach: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('surface', input.surface),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                attachIncompatible(`Surface '${input.surface}' not found`),
              ),
            (existing) => {
              const kind = String((existing as any).kind ?? '');
              const compatible = RENDERER_COMPAT[kind] ?? [];
              if (!compatible.includes(input.renderer)) {
                return TE.right(
                  attachIncompatible(
                    `Renderer '${input.renderer}' is not compatible with surface kind '${kind}'. ` +
                    `Compatible renderers: ${compatible.join(', ')}`,
                  ),
                );
              }
              return TE.tryCatch(
                async () => {
                  await storage.put('surface', input.surface, {
                    ...existing,
                    renderer: input.renderer,
                    status: 'attached',
                  });
                  return attachOk(input.surface);
                },
                storageErr,
              );
            },
          ),
        ),
      ),
    ),

  resize: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('surface', input.surface),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resizeNotfound(`Surface '${input.surface}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('surface', input.surface, {
                    ...existing,
                    width: input.width,
                    height: input.height,
                  });
                  return resizeOk(input.surface);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  mount: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('surface', input.surface),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(mountNotfound(`Surface '${input.surface}' not found`)),
            (existing) => {
              // Must have a renderer attached before mounting
              if ((existing as any).renderer === null) {
                return TE.right(
                  mountError('Cannot mount: no renderer attached to this surface'),
                );
              }
              const zone = pipe(input.zone, O.getOrElse(() => 'default'));
              return TE.tryCatch(
                async () => {
                  const zones: Record<string, unknown> = { ...((existing as any).zones ?? {}) };
                  zones[zone] = { tree: input.tree, mountedAt: new Date().toISOString() };
                  await storage.put('surface', input.surface, {
                    ...existing,
                    zones,
                    status: 'mounted',
                  });
                  return mountOk(input.surface);
                },
                storageErr,
              );
            },
          ),
        ),
      ),
    ),

  unmount: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('surface', input.surface),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(unmountNotfound(`Surface '${input.surface}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const zone = pipe(input.zone, O.getOrElse(() => 'default'));
                  const zones: Record<string, unknown> = { ...((existing as any).zones ?? {}) };
                  delete zones[zone];
                  const hasZones = Object.keys(zones).length > 0;
                  await storage.put('surface', input.surface, {
                    ...existing,
                    zones,
                    status: hasZones ? 'mounted' : 'attached',
                  });
                  return unmountOk(input.surface);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('surface', input.surface),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(destroyNotfound(`Surface '${input.surface}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('surface', input.surface);
                  return destroyOk(input.surface);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),
};
