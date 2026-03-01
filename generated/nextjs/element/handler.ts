// Element — UI element type registration, prop management, and element tree hierarchy.
// Creates typed UI elements (text, input, container, etc.), nests them into a hierarchy,
// applies constraints, enriches with interactor behavior, and assigns widget renderers.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ElementStorage,
  ElementCreateInput,
  ElementCreateOutput,
  ElementNestInput,
  ElementNestOutput,
  ElementSetConstraintsInput,
  ElementSetConstraintsOutput,
  ElementEnrichInput,
  ElementEnrichOutput,
  ElementAssignWidgetInput,
  ElementAssignWidgetOutput,
  ElementRemoveInput,
  ElementRemoveOutput,
} from './types.js';

import {
  createOk,
  createInvalid,
  nestOk,
  nestInvalid,
  setConstraintsOk,
  setConstraintsNotfound,
  enrichOk,
  enrichNotfound,
  assignWidgetOk,
  assignWidgetNotfound,
  removeOk,
  removeNotfound,
} from './types.js';

export interface ElementError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): ElementError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_KINDS = [
  'text', 'input', 'button', 'container', 'image', 'link',
  'list', 'table', 'form', 'select', 'checkbox', 'radio',
  'textarea', 'toggle', 'slider', 'divider', 'icon', 'custom',
] as const;

const VALID_DATA_TYPES = [
  'string', 'number', 'boolean', 'date', 'enum', 'array', 'object', 'any',
] as const;

export interface ElementHandler {
  readonly create: (
    input: ElementCreateInput,
    storage: ElementStorage,
  ) => TE.TaskEither<ElementError, ElementCreateOutput>;
  readonly nest: (
    input: ElementNestInput,
    storage: ElementStorage,
  ) => TE.TaskEither<ElementError, ElementNestOutput>;
  readonly setConstraints: (
    input: ElementSetConstraintsInput,
    storage: ElementStorage,
  ) => TE.TaskEither<ElementError, ElementSetConstraintsOutput>;
  readonly enrich: (
    input: ElementEnrichInput,
    storage: ElementStorage,
  ) => TE.TaskEither<ElementError, ElementEnrichOutput>;
  readonly assignWidget: (
    input: ElementAssignWidgetInput,
    storage: ElementStorage,
  ) => TE.TaskEither<ElementError, ElementAssignWidgetOutput>;
  readonly remove: (
    input: ElementRemoveInput,
    storage: ElementStorage,
  ) => TE.TaskEither<ElementError, ElementRemoveOutput>;
}

// --- Implementation ---

export const elementHandler: ElementHandler = {
  create: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!(VALID_KINDS as readonly string[]).includes(inp.kind)) {
          return TE.right(
            createInvalid(
              `Invalid element kind '${inp.kind}'. Must be one of: ${VALID_KINDS.join(', ')}`,
            ),
          );
        }
        if (!(VALID_DATA_TYPES as readonly string[]).includes(inp.dataType)) {
          return TE.right(
            createInvalid(
              `Invalid data type '${inp.dataType}'. Must be one of: ${VALID_DATA_TYPES.join(', ')}`,
            ),
          );
        }
        if (inp.label.trim().length === 0) {
          return TE.right(createInvalid('Element label must not be empty'));
        }

        return TE.tryCatch(
          async () => {
            await storage.put('element', inp.element, {
              element: inp.element,
              kind: inp.kind,
              label: inp.label,
              dataType: inp.dataType,
              children: [],
              parentElement: null,
              constraints: null,
              interactor: null,
              widget: null,
            });
            return createOk(inp.element);
          },
          storageErr,
        );
      }),
    ),

  nest: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('element', input.parent),
          storage.get('element', input.child),
        ]),
        storageErr,
      ),
      TE.chain(([parentRecord, childRecord]) => {
        if (parentRecord === null) {
          return TE.right(nestInvalid(`Parent element '${input.parent}' not found`));
        }
        if (childRecord === null) {
          return TE.right(nestInvalid(`Child element '${input.child}' not found`));
        }
        if (input.parent === input.child) {
          return TE.right(nestInvalid('An element cannot be nested inside itself'));
        }
        // Prevent nesting if child already has a parent
        if ((childRecord as any).parentElement !== null && (childRecord as any).parentElement !== undefined) {
          return TE.right(
            nestInvalid(
              `Child '${input.child}' is already nested under '${String((childRecord as any).parentElement)}'`,
            ),
          );
        }

        return TE.tryCatch(
          async () => {
            const existingChildren: readonly string[] = (parentRecord as any).children ?? [];
            await storage.put('element', input.parent, {
              ...parentRecord,
              children: [...existingChildren, input.child],
            });
            await storage.put('element', input.child, {
              ...childRecord,
              parentElement: input.parent,
            });
            return nestOk(input.parent);
          },
          storageErr,
        );
      }),
    ),

  setConstraints: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('element', input.element),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(setConstraintsNotfound(`Element '${input.element}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('element', input.element, {
                    ...existing,
                    constraints: input.constraints,
                  });
                  return setConstraintsOk(input.element);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  enrich: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('element', input.element),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(enrichNotfound(`Element '${input.element}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('element', input.element, {
                    ...existing,
                    interactor: {
                      type: input.interactorType,
                      props: input.interactorProps,
                    },
                  });
                  return enrichOk(input.element);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  assignWidget: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('element', input.element),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(assignWidgetNotfound(`Element '${input.element}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('element', input.element, {
                    ...existing,
                    widget: input.widget,
                  });
                  return assignWidgetOk(input.element);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),

  remove: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('element', input.element),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(removeNotfound(`Element '${input.element}' not found`)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  // Unlink from parent if nested
                  const parentId = (existing as any).parentElement;
                  if (parentId !== null && parentId !== undefined) {
                    const parent = await storage.get('element', parentId);
                    if (parent !== null) {
                      const children: readonly string[] = ((parent as any).children ?? [])
                        .filter((c: string) => c !== input.element);
                      await storage.put('element', parentId, { ...parent, children });
                    }
                  }
                  await storage.delete('element', input.element);
                  return removeOk(input.element);
                },
                storageErr,
              ),
          ),
        ),
      ),
    ),
};
