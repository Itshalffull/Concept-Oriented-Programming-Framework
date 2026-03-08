// HonoTarget — Hono routing layer for desktop local server target.
// Mirrors the Next.js API route structure using the same fp-ts concept handlers.
// Mounts fp-ts handlers on a Hono router running on Bun for desktop apps.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  HonoTargetStorage,
  HonoTargetRegisterInput,
  HonoTargetRegisterOutput,
  HonoTargetGenerateInput,
  HonoTargetGenerateOutput,
  HonoTargetListRoutesInput,
  HonoTargetListRoutesOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  generateOk,
  generateError,
  listRoutesOk,
  listRoutesNotfound,
} from './types.js';

export interface HonoTargetError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): HonoTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface HonoTargetHandler {
  readonly register: (
    input: HonoTargetRegisterInput,
    storage: HonoTargetStorage,
  ) => TE.TaskEither<HonoTargetError, HonoTargetRegisterOutput>;
  readonly generate: (
    input: HonoTargetGenerateInput,
    storage: HonoTargetStorage,
  ) => TE.TaskEither<HonoTargetError, HonoTargetGenerateOutput>;
  readonly listRoutes: (
    input: HonoTargetListRoutesInput,
    storage: HonoTargetStorage,
  ) => TE.TaskEither<HonoTargetError, HonoTargetListRoutesOutput>;
}

export const honoTargetHandler: HonoTargetHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hono_targets', input.target_name),
        toStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const routes: string[] = [];
                  // Generate standard REST routes for the target
                  const basePath = input.base_path || '/api';
                  routes.push(`POST ${basePath}/:concept/:action`);
                  routes.push(`GET ${basePath}/:concept/:action`);
                  routes.push(`GET ${basePath}/health`);

                  await storage.put('hono_targets', input.target_name, {
                    target_name: input.target_name,
                    base_path: basePath,
                    middleware: input.middleware ?? null,
                    routes: JSON.stringify(routes),
                    created_at: new Date().toISOString(),
                  });
                  return registerOk(input.target_name, routes.length);
                },
                toStorageError,
              ),
            () => TE.right(registerAlreadyRegistered(input.target_name)),
          ),
        ),
      ),
    ),

  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.manifest_uri) {
            return generateError('manifest_uri is required');
          }

          // Generate Hono route files mirroring the Next.js structure
          const files: string[] = [
            `${input.output_dir}/index.ts`,
            `${input.output_dir}/routes.ts`,
            `${input.output_dir}/middleware.ts`,
          ];

          await storage.put('hono_generated', input.manifest_uri, {
            manifest_uri: input.manifest_uri,
            output_dir: input.output_dir,
            files: JSON.stringify(files),
            generated_at: new Date().toISOString(),
          });

          return generateOk(files, files.length);
        },
        toStorageError,
      ),
    ),

  listRoutes: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('hono_targets', input.target_name),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                listRoutesNotfound(`Hono target '${input.target_name}' not found`),
              ),
            (found) => {
              const routes: string[] = JSON.parse(String(found['routes'] ?? '[]'));
              return TE.right(listRoutesOk(routes));
            },
          ),
        ),
      ),
    ),
};
