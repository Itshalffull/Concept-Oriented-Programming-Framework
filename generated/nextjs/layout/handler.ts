// Layout — layout engine supporting flex, grid, and stack modes with responsive breakpoints.
// Creates named layouts, configures their properties (gap, alignment, columns, etc.),
// nests layouts with cycle detection, and applies responsive breakpoint overrides.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  LayoutStorage,
  LayoutCreateInput,
  LayoutCreateOutput,
  LayoutConfigureInput,
  LayoutConfigureOutput,
  LayoutNestInput,
  LayoutNestOutput,
  LayoutSetResponsiveInput,
  LayoutSetResponsiveOutput,
  LayoutRemoveInput,
  LayoutRemoveOutput,
} from './types.js';

import {
  createOk,
  createInvalid,
  configureOk,
  configureNotfound,
  nestOk,
  nestCycle,
  setResponsiveOk,
  setResponsiveNotfound,
  removeOk,
  removeNotfound,
} from './types.js';

export interface LayoutError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): LayoutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_KINDS = ['flex', 'grid', 'stack', 'absolute', 'flow'] as const;

/** Walk up the parent chain to detect cycles before nesting. */
const wouldCreateCycle = async (
  storage: { readonly get: (relation: string, key: string) => Promise<Record<string, unknown> | null> },
  parentId: string,
  childId: string,
): Promise<boolean> => {
  // If the child is an ancestor of the parent, nesting parent->child would create a cycle
  let current: string | null = parentId;
  const visited = new Set<string>();
  while (current !== null) {
    if (current === childId) return true;
    if (visited.has(current)) return false; // already seen, no cycle through childId
    visited.add(current);
    const record = await storage.get('layout', current);
    current = record !== null ? (record as any).parentLayout ?? null : null;
  }
  return false;
};

export interface LayoutHandler {
  readonly create: (
    input: LayoutCreateInput,
    storage: LayoutStorage,
  ) => TE.TaskEither<LayoutError, LayoutCreateOutput>;
  readonly configure: (
    input: LayoutConfigureInput,
    storage: LayoutStorage,
  ) => TE.TaskEither<LayoutError, LayoutConfigureOutput>;
  readonly nest: (
    input: LayoutNestInput,
    storage: LayoutStorage,
  ) => TE.TaskEither<LayoutError, LayoutNestOutput>;
  readonly setResponsive: (
    input: LayoutSetResponsiveInput,
    storage: LayoutStorage,
  ) => TE.TaskEither<LayoutError, LayoutSetResponsiveOutput>;
  readonly remove: (
    input: LayoutRemoveInput,
    storage: LayoutStorage,
  ) => TE.TaskEither<LayoutError, LayoutRemoveOutput>;
}

// --- Implementation ---

export const layoutHandler: LayoutHandler = {
  create: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!(VALID_KINDS as readonly string[]).includes(inp.kind)) {
          return TE.right(
            createInvalid(
              `Invalid layout kind '${inp.kind}'. Must be one of: ${VALID_KINDS.join(', ')}`,
            ),
          );
        }
        if (inp.name.trim().length === 0) {
          return TE.right(createInvalid('Layout name must not be empty'));
        }

        return TE.tryCatch(
          async () => {
            await storage.put('layout', inp.layout, {
              layout: inp.layout,
              name: inp.name,
              kind: inp.kind,
              config: {},
              children: [],
              parentLayout: null,
              breakpoints: null,
            });
            return createOk(inp.layout);
          },
          storageErr,
        );
      }),
    ),

  configure: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('layout', input.layout),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(configureNotfound(`Layout '${input.layout}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const parsed: unknown = JSON.parse(input.config);
                  await storage.put('layout', input.layout, {
                    ...existing,
                    config: parsed,
                  });
                  return configureOk(input.layout);
                },
                (error) => {
                  if (error instanceof SyntaxError) {
                    return {
                      code: 'PARSE_ERROR',
                      message: `Invalid JSON in layout config: ${error.message}`,
                    } as LayoutError;
                  }
                  return storageErr(error);
                },
              ),
          ),
        ),
      ),
    ),

  nest: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const [parentRecord, childRecord] = await Promise.all([
            storage.get('layout', input.parent),
            storage.get('layout', input.child),
          ]);
          return { parentRecord, childRecord };
        },
        storageErr,
      ),
      TE.chain(({ parentRecord, childRecord }) => {
        if (parentRecord === null || childRecord === null) {
          return TE.right(
            nestCycle(
              parentRecord === null
                ? `Parent layout '${input.parent}' not found`
                : `Child layout '${input.child}' not found`,
            ),
          );
        }
        if (input.parent === input.child) {
          return TE.right(nestCycle('A layout cannot be nested inside itself'));
        }

        return TE.tryCatch(
          async () => {
            // Cycle detection: check if child is an ancestor of parent
            const hasCycle = await wouldCreateCycle(storage, input.parent, input.child);
            if (hasCycle) {
              return nestCycle(
                `Nesting '${input.child}' under '${input.parent}' would create a cycle`,
              );
            }

            const children: readonly string[] = (parentRecord as any).children ?? [];
            await storage.put('layout', input.parent, {
              ...parentRecord,
              children: [...children, input.child],
            });
            await storage.put('layout', input.child, {
              ...childRecord,
              parentLayout: input.parent,
            });
            return nestOk(input.parent);
          },
          storageErr,
        );
      }),
    ),

  setResponsive: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('layout', input.layout),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(setResponsiveNotfound(`Layout '${input.layout}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const parsed: unknown = JSON.parse(input.breakpoints);
                  await storage.put('layout', input.layout, {
                    ...existing,
                    breakpoints: parsed,
                  });
                  return setResponsiveOk(input.layout);
                },
                (error) => {
                  if (error instanceof SyntaxError) {
                    return {
                      code: 'PARSE_ERROR',
                      message: `Invalid JSON in breakpoints: ${error.message}`,
                    } as LayoutError;
                  }
                  return storageErr(error);
                },
              ),
          ),
        ),
      ),
    ),

  remove: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('layout', input.layout),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(removeNotfound(`Layout '${input.layout}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Unlink from parent
                  const parentId = (existing as any).parentLayout;
                  if (parentId !== null && parentId !== undefined) {
                    const parent = await storage.get('layout', parentId);
                    if (parent !== null) {
                      const children: readonly string[] = ((parent as any).children ?? [])
                        .filter((c: string) => c !== input.layout);
                      await storage.put('layout', parentId, { ...parent, children });
                    }
                  }
                  await storage.delete('layout', input.layout);
                  return removeOk(input.layout);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),
};
