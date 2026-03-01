// Component — handler.ts
// Surface concept: component registry and lifecycle.
// Registers components with metadata, resolves dependencies,
// tracks render tree, manages visibility, and evaluates visibility rules.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ComponentStorage,
  ComponentRegisterInput,
  ComponentRegisterOutput,
  ComponentRenderInput,
  ComponentRenderOutput,
  ComponentPlaceInput,
  ComponentPlaceOutput,
  ComponentSetVisibilityInput,
  ComponentSetVisibilityOutput,
  ComponentEvaluateVisibilityInput,
  ComponentEvaluateVisibilityOutput,
} from './types.js';

import {
  registerOk,
  registerExists,
  renderOk,
  renderNotfound,
  placeOk,
  placeNotfound,
  setVisibilityOk,
  setVisibilityNotfound,
  evaluateVisibilityOk,
  evaluateVisibilityNotfound,
} from './types.js';

export interface ComponentError {
  readonly code: string;
  readonly message: string;
}

export interface ComponentHandler {
  readonly register: (
    input: ComponentRegisterInput,
    storage: ComponentStorage,
  ) => TE.TaskEither<ComponentError, ComponentRegisterOutput>;
  readonly render: (
    input: ComponentRenderInput,
    storage: ComponentStorage,
  ) => TE.TaskEither<ComponentError, ComponentRenderOutput>;
  readonly place: (
    input: ComponentPlaceInput,
    storage: ComponentStorage,
  ) => TE.TaskEither<ComponentError, ComponentPlaceOutput>;
  readonly setVisibility: (
    input: ComponentSetVisibilityInput,
    storage: ComponentStorage,
  ) => TE.TaskEither<ComponentError, ComponentSetVisibilityOutput>;
  readonly evaluateVisibility: (
    input: ComponentEvaluateVisibilityInput,
    storage: ComponentStorage,
  ) => TE.TaskEither<ComponentError, ComponentEvaluateVisibilityOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): ComponentError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const evaluateVisibilityRules = (
  config: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean => {
  // Check explicit visibility override
  if (config['visible'] === false) {
    return false;
  }

  // Check conditional visibility rules
  const rules = config['visibilityRules'];
  if (!rules || !Array.isArray(rules)) {
    return config['visible'] !== false;
  }

  // Each rule is { field, operator, value }
  return (rules as readonly Record<string, unknown>[]).every((rule) => {
    const field = String(rule['field'] ?? '');
    const operator = String(rule['operator'] ?? 'eq');
    const expected = rule['value'];
    const actual = context[field];

    switch (operator) {
      case 'eq': return actual === expected;
      case 'neq': return actual !== expected;
      case 'truthy': return Boolean(actual);
      case 'falsy': return !actual;
      case 'gt': return Number(actual) > Number(expected);
      case 'lt': return Number(actual) < Number(expected);
      case 'contains': return String(actual).includes(String(expected));
      default: return true;
    }
  });
};

// --- Implementation ---

export const componentHandler: ComponentHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('components', input.component),
        mkStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  let parsedConfig: Record<string, unknown>;
                  try {
                    parsedConfig = JSON.parse(input.config);
                  } catch {
                    parsedConfig = { raw: input.config };
                  }

                  const record = {
                    component: input.component,
                    config: input.config,
                    visible: true,
                    region: '',
                    dependencies: parsedConfig['dependencies'] ?? [],
                    createdAt: new Date().toISOString(),
                  };
                  await storage.put('components', input.component, record);
                  return registerOk();
                },
                mkStorageError,
              ),
            () =>
              TE.right(
                registerExists(`Component "${input.component}" already registered`),
              ),
          ),
        ),
      ),
    ),

  render: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('components', input.component),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                renderNotfound(`Component "${input.component}" not found`),
              ),
            (found) => {
              // Check visibility before rendering
              if (found['visible'] === false) {
                return TE.right(
                  renderOk(JSON.stringify({
                    component: input.component,
                    rendered: false,
                    reason: 'hidden',
                  })),
                );
              }

              let contextObj: Record<string, unknown>;
              try {
                contextObj = JSON.parse(input.context);
              } catch {
                contextObj = {};
              }

              // Build render output with component metadata
              const output = {
                component: input.component,
                rendered: true,
                config: String(found['config'] ?? '{}'),
                region: String(found['region'] ?? ''),
                context: contextObj,
                renderedAt: new Date().toISOString(),
              };

              return TE.tryCatch(
                async () => {
                  // Track render event
                  const updated = {
                    ...found,
                    lastRendered: new Date().toISOString(),
                  };
                  await storage.put('components', input.component, updated);
                  return renderOk(JSON.stringify(output));
                },
                mkStorageError,
              );
            },
          ),
        ),
      ),
    ),

  place: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('components', input.component),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                placeNotfound(`Component "${input.component}" not found`),
              ),
            (found) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...found,
                    region: input.region,
                    placedAt: new Date().toISOString(),
                  };
                  await storage.put('components', input.component, updated);
                  return placeOk();
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),

  setVisibility: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('components', input.component),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                setVisibilityNotfound(`Component "${input.component}" not found`),
              ),
            (found) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...found,
                    visible: input.visible,
                    visibilityChangedAt: new Date().toISOString(),
                  };
                  await storage.put('components', input.component, updated);
                  return setVisibilityOk();
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),

  evaluateVisibility: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('components', input.component),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                evaluateVisibilityNotfound(`Component "${input.component}" not found`),
              ),
            (found) => {
              let configObj: Record<string, unknown>;
              try {
                configObj = JSON.parse(String(found['config'] ?? '{}'));
              } catch {
                configObj = {};
              }

              // Merge stored visibility state into config
              configObj['visible'] = found['visible'];
              configObj['visibilityRules'] = configObj['visibilityRules'] ?? [];

              let contextObj: Record<string, unknown>;
              try {
                contextObj = JSON.parse(input.context);
              } catch {
                contextObj = {};
              }

              const isVisible = evaluateVisibilityRules(configObj, contextObj);
              return TE.right(evaluateVisibilityOk(isVisible));
            },
          ),
        ),
      ),
    ),
};
