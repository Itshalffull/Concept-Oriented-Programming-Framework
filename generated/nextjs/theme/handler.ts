// Theme — theme configuration, token resolution, theme switching, and override merging.
// Creates named themes with override maps, extends themes from a base with deep merge,
// activates/deactivates themes by priority, and resolves the final merged token set.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ThemeStorage,
  ThemeCreateInput,
  ThemeCreateOutput,
  ThemeExtendInput,
  ThemeExtendOutput,
  ThemeActivateInput,
  ThemeActivateOutput,
  ThemeDeactivateInput,
  ThemeDeactivateOutput,
  ThemeResolveInput,
  ThemeResolveOutput,
} from './types.js';

import {
  createOk,
  createDuplicate,
  extendOk,
  extendNotfound,
  activateOk,
  activateNotfound,
  deactivateOk,
  deactivateNotfound,
  resolveOk,
  resolveNotfound,
} from './types.js';

export interface ThemeError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): ThemeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Deep merge two plain objects. Values in `overrides` take precedence. */
const deepMerge = (
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
};

export interface ThemeHandler {
  readonly create: (
    input: ThemeCreateInput,
    storage: ThemeStorage,
  ) => TE.TaskEither<ThemeError, ThemeCreateOutput>;
  readonly extend: (
    input: ThemeExtendInput,
    storage: ThemeStorage,
  ) => TE.TaskEither<ThemeError, ThemeExtendOutput>;
  readonly activate: (
    input: ThemeActivateInput,
    storage: ThemeStorage,
  ) => TE.TaskEither<ThemeError, ThemeActivateOutput>;
  readonly deactivate: (
    input: ThemeDeactivateInput,
    storage: ThemeStorage,
  ) => TE.TaskEither<ThemeError, ThemeDeactivateOutput>;
  readonly resolve: (
    input: ThemeResolveInput,
    storage: ThemeStorage,
  ) => TE.TaskEither<ThemeError, ThemeResolveOutput>;
}

// --- Implementation ---

export const themeHandler: ThemeHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('theme', input.theme),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const overrides = JSON.parse(input.overrides);
                  await storage.put('theme', input.theme, {
                    theme: input.theme,
                    name: input.name,
                    overrides,
                    base: null,
                    active: false,
                    priority: 0,
                  });
                  return createOk(input.theme);
                },
                (error) => {
                  if (error instanceof SyntaxError) {
                    return {
                      code: 'PARSE_ERROR',
                      message: `Invalid JSON in overrides: ${error.message}`,
                    } as ThemeError;
                  }
                  return storageErr(error);
                },
              ),
            () => TE.right(createDuplicate(`Theme '${input.theme}' already exists`)),
          ),
        ),
      ),
    ),

  extend: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('theme', input.base),
        storageErr,
      ),
      TE.chain((baseRecord) =>
        pipe(
          O.fromNullable(baseRecord),
          O.fold(
            () => TE.right(extendNotfound(`Base theme '${input.base}' not found`)),
            (baseTheme) =>
              TE.tryCatch(
                async () => {
                  const childOverrides = JSON.parse(input.overrides);
                  // Merge base overrides with child overrides
                  const baseOverrides = (baseTheme as any).overrides ?? {};
                  const merged = deepMerge(baseOverrides, childOverrides);

                  await storage.put('theme', input.theme, {
                    theme: input.theme,
                    name: input.theme,
                    overrides: merged,
                    base: input.base,
                    active: false,
                    priority: 0,
                  });
                  return extendOk(input.theme);
                },
                (error) => {
                  if (error instanceof SyntaxError) {
                    return {
                      code: 'PARSE_ERROR',
                      message: `Invalid JSON in overrides: ${error.message}`,
                    } as ThemeError;
                  }
                  return storageErr(error);
                },
              ),
          ),
        ),
      ),
    ),

  activate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('theme', input.theme),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(activateNotfound(`Theme '${input.theme}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('theme', input.theme, {
                    ...existing,
                    active: true,
                    priority: input.priority,
                  });
                  return activateOk(input.theme);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  deactivate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('theme', input.theme),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(deactivateNotfound(`Theme '${input.theme}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('theme', input.theme, {
                    ...existing,
                    active: false,
                    priority: 0,
                  });
                  return deactivateOk(input.theme);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('theme', input.theme),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotfound(`Theme '${input.theme}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  // Walk the inheritance chain, collecting overrides
                  const overridesChain: Record<string, unknown>[] = [];
                  let current: Record<string, unknown> | null = found;

                  while (current !== null) {
                    overridesChain.unshift((current as any).overrides ?? {});
                    const baseId = (current as any).base;
                    if (baseId !== null && baseId !== undefined) {
                      current = await storage.get('theme', baseId);
                    } else {
                      current = null;
                    }
                  }

                  // Merge from root ancestor forward so child overrides win
                  const tokens = overridesChain.reduce(
                    (acc, overrides) => deepMerge(acc, overrides),
                    {} as Record<string, unknown>,
                  );

                  return resolveOk(JSON.stringify(tokens));
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),
};
