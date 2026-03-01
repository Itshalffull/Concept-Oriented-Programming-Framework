// DisplayMode — handler.ts
// Named presentation profiles controlling per-field rendering in different
// contexts (view, edit, teaser). Field display and form configuration
// with entity rendering through mode-specific rules.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DisplayModeStorage,
  DisplayModeDefineModeInput,
  DisplayModeDefineModeOutput,
  DisplayModeConfigureFieldDisplayInput,
  DisplayModeConfigureFieldDisplayOutput,
  DisplayModeConfigureFieldFormInput,
  DisplayModeConfigureFieldFormOutput,
  DisplayModeRenderInModeInput,
  DisplayModeRenderInModeOutput,
} from './types.js';

import {
  defineModeOk,
  defineModeExists,
  configureFieldDisplayOk,
  configureFieldDisplayNotfound,
  configureFieldFormOk,
  configureFieldFormNotfound,
  renderInModeOk,
  renderInModeNotfound,
} from './types.js';

export interface DisplayModeError {
  readonly code: string;
  readonly message: string;
}

export interface DisplayModeHandler {
  readonly defineMode: (
    input: DisplayModeDefineModeInput,
    storage: DisplayModeStorage,
  ) => TE.TaskEither<DisplayModeError, DisplayModeDefineModeOutput>;
  readonly configureFieldDisplay: (
    input: DisplayModeConfigureFieldDisplayInput,
    storage: DisplayModeStorage,
  ) => TE.TaskEither<DisplayModeError, DisplayModeConfigureFieldDisplayOutput>;
  readonly configureFieldForm: (
    input: DisplayModeConfigureFieldFormInput,
    storage: DisplayModeStorage,
  ) => TE.TaskEither<DisplayModeError, DisplayModeConfigureFieldFormOutput>;
  readonly renderInMode: (
    input: DisplayModeRenderInModeInput,
    storage: DisplayModeStorage,
  ) => TE.TaskEither<DisplayModeError, DisplayModeRenderInModeOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): DisplayModeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON object safely, returning empty object on failure. */
const safeParseObj = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string') return {};
  try {
    const p = JSON.parse(raw);
    return typeof p === 'object' && p !== null ? p : {};
  } catch {
    return {};
  }
};

/** Apply a display configuration to a field value for rendering. */
const applyDisplayConfig = (
  value: unknown,
  config: string,
): unknown => {
  const strValue = String(value ?? '');

  switch (config) {
    case 'truncated':
      return strValue.length > 100 ? `${strValue.slice(0, 100)}...` : strValue;
    case 'hidden':
      return '';
    case 'uppercase':
      return strValue.toUpperCase();
    case 'lowercase':
      return strValue.toLowerCase();
    case 'bold':
      return `**${strValue}**`;
    case 'italic':
      return `_${strValue}_`;
    case 'date_short':
      try {
        return new Date(strValue).toLocaleDateString();
      } catch {
        return strValue;
      }
    case 'date_long':
      try {
        return new Date(strValue).toLocaleString();
      } catch {
        return strValue;
      }
    case 'number_formatted':
      try {
        return Number(strValue).toLocaleString();
      } catch {
        return strValue;
      }
    case 'full':
    default:
      return strValue;
  }
};

// --- Implementation ---

export const displayModeHandler: DisplayModeHandler = {
  /**
   * Register a new display mode with a unique name.
   * Initializes empty field display and form configuration maps.
   */
  defineMode: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('modes', { name: input.name }),
        storageErr,
      ),
      TE.chain((existing) =>
        existing.length > 0
          ? TE.right(
              defineModeExists(
                `Mode '${input.name}' already exists`,
              ),
            )
          : pipe(
              TE.tryCatch(
                () =>
                  storage.put('modes', input.mode, {
                    modeId: input.mode,
                    name: input.name,
                    fieldDisplayConfigs: JSON.stringify({}),
                    fieldFormConfigs: JSON.stringify({}),
                    createdAt: new Date().toISOString(),
                  }),
                storageErr,
              ),
              TE.map(() => defineModeOk(input.mode)),
            ),
      ),
    ),

  /**
   * Set the display configuration for a specific field within a mode.
   * The config string specifies how the field should render
   * (e.g., 'truncated', 'hidden', 'bold', 'date_short').
   */
  configureFieldDisplay: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('modes', input.mode),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                configureFieldDisplayNotfound(
                  `Mode '${input.mode}' does not exist`,
                ),
              ),
            (found) => {
              const displayConfigs = safeParseObj(
                found['fieldDisplayConfigs'],
              );
              displayConfigs[input.field] = input.config;

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('modes', input.mode, {
                      ...found,
                      fieldDisplayConfigs: JSON.stringify(displayConfigs),
                    }),
                  storageErr,
                ),
                TE.map(() => configureFieldDisplayOk(input.mode)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Set the form configuration for a specific field within a mode.
   * Controls how the field appears in edit/form contexts
   * (e.g., widget type, validation, placeholder text).
   */
  configureFieldForm: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('modes', input.mode),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                configureFieldFormNotfound(
                  `Mode '${input.mode}' does not exist`,
                ),
              ),
            (found) => {
              const formConfigs = safeParseObj(found['fieldFormConfigs']);
              formConfigs[input.field] = input.config;

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('modes', input.mode, {
                      ...found,
                      fieldFormConfigs: JSON.stringify(formConfigs),
                    }),
                  storageErr,
                ),
                TE.map(() => configureFieldFormOk(input.mode)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Render an entity using the display configurations of the specified mode.
   * Fetches the entity data, applies each field's display config, and
   * returns the rendered output as a JSON object.
   */
  renderInMode: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('modes', input.mode),
        storageErr,
      ),
      TE.chain((modeRec) =>
        pipe(
          O.fromNullable(modeRec),
          O.fold(
            () =>
              TE.right(
                renderInModeNotfound(
                  `Mode '${input.mode}' does not exist`,
                ),
              ),
            (found) =>
              pipe(
                TE.tryCatch(
                  () => storage.get('entities', input.entity),
                  storageErr,
                ),
                TE.map((entityRec) => {
                  const entity =
                    entityRec !== null
                      ? (entityRec as Record<string, unknown>)
                      : {};
                  const displayConfigs = safeParseObj(
                    found['fieldDisplayConfigs'],
                  );

                  // Apply display config to each field
                  const rendered: Record<string, unknown> = {};
                  for (const [field, value] of Object.entries(entity)) {
                    const config = String(displayConfigs[field] ?? 'full');
                    rendered[field] = applyDisplayConfig(value, config);
                  }

                  // Include mode metadata
                  rendered['_mode'] = String(found['name'] ?? input.mode);
                  rendered['_entity'] = input.entity;

                  return renderInModeOk(JSON.stringify(rendered));
                }),
              ),
          ),
        ),
      ),
    ),
};
