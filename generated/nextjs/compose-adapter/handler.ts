// ComposeAdapter — Normalizes Clef widget props into Jetpack Compose composable equivalents.
// Maps abstract layout, typography, and interaction properties to Compose Modifier chains
// and Material3 composable functions.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ComposeAdapterStorage,
  ComposeAdapterNormalizeInput,
  ComposeAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface ComposeAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface ComposeAdapterHandler {
  readonly normalize: (
    input: ComposeAdapterNormalizeInput,
    storage: ComposeAdapterStorage,
  ) => TE.TaskEither<ComposeAdapterError, ComposeAdapterNormalizeOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): ComposeAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map of abstract widget types to their Jetpack Compose composable equivalents. */
const WIDGET_TO_COMPOSABLE: Readonly<Record<string, string>> = {
  text: 'Text',
  button: 'Button',
  image: 'Image',
  container: 'Box',
  scroll: 'LazyColumn',
  list: 'LazyColumn',
  listItem: 'ListItem',
  input: 'TextField',
  toggle: 'Switch',
  slider: 'Slider',
  progress: 'LinearProgressIndicator',
  divider: 'Divider',
  card: 'Card',
  grid: 'LazyVerticalGrid',
  tab: 'TabRow',
  dialog: 'AlertDialog',
  scaffold: 'Scaffold',
  topbar: 'TopAppBar',
  bottombar: 'BottomAppBar',
  fab: 'FloatingActionButton',
  chip: 'AssistChip',
  surface: 'Surface',
  icon: 'Icon',
  checkbox: 'Checkbox',
  radio: 'RadioButton',
};

/** Parse props JSON into a record. */
const parseProps = (props: string): Record<string, unknown> | null =>
  pipe(
    O.tryCatch(() => JSON.parse(props) as Record<string, unknown>),
    O.toNullable,
  );

/** Normalize abstract layout properties to Compose Modifier chain operations. */
const normalizeModifiers = (props: Record<string, unknown>): readonly string[] => {
  const modifiers: string[] = [];

  const padding = props['padding'] as number | undefined;
  if (padding !== undefined) {
    modifiers.push(`padding(${padding}.dp)`);
  }

  const margin = props['margin'] as number | undefined;
  if (margin !== undefined) {
    // Compose uses padding on the outer composable; no direct "margin"
    modifiers.push(`padding(${margin}.dp)`);
  }

  const width = props['width'] as number | string | undefined;
  if (width !== undefined) {
    modifiers.push(width === 'match_parent' ? 'fillMaxWidth()' : `width(${width}.dp)`);
  }

  const height = props['height'] as number | string | undefined;
  if (height !== undefined) {
    modifiers.push(height === 'match_parent' ? 'fillMaxHeight()' : `height(${height}.dp)`);
  }

  if (props['onClick'] !== undefined) {
    modifiers.push('clickable { onClick() }');
  }

  const background = props['background'] as string | undefined;
  if (background !== undefined) {
    modifiers.push(`background(Color(${background}))`);
  }

  const cornerRadius = props['cornerRadius'] as number | undefined;
  if (cornerRadius !== undefined) {
    modifiers.push(`clip(RoundedCornerShape(${cornerRadius}.dp))`);
  }

  return modifiers;
};

/** Determine the Compose layout container from direction properties. */
const normalizeContainer = (props: Record<string, unknown>): string | null => {
  const direction = props['direction'] as string | undefined;
  if (direction === 'horizontal') return 'Row';
  if (direction === 'vertical') return 'Column';
  return null;
};

/** Normalize alignment to Compose Arrangement/Alignment values. */
const normalizeArrangement = (props: Record<string, unknown>): Record<string, string> => {
  const result: Record<string, string> = {};

  const alignment = props['alignment'] as string | undefined;
  if (alignment !== undefined) {
    const alignMap: Record<string, string> = {
      start: 'Alignment.Start',
      center: 'Alignment.CenterHorizontally',
      end: 'Alignment.End',
    };
    result['horizontalAlignment'] = alignMap[alignment] ?? alignment;
  }

  const spacing = props['spacing'] as number | undefined;
  if (spacing !== undefined) {
    result['verticalArrangement'] = `Arrangement.spacedBy(${spacing}.dp)`;
  }

  return result;
};

// --- Implementation ---

export const composeAdapterHandler: ComposeAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const parsed = parseProps(input.props);

          if (parsed === null) {
            return normalizeError(
              `Failed to parse props for adapter '${input.adapter}': invalid JSON`,
            );
          }

          const widgetType = (parsed['type'] as string | undefined) ?? input.adapter;
          const composable = WIDGET_TO_COMPOSABLE[widgetType.toLowerCase()];

          if (composable === undefined) {
            return normalizeError(
              `No Jetpack Compose composable mapping for widget type '${widgetType}'`,
            );
          }

          const modifiers = normalizeModifiers(parsed);
          const container = normalizeContainer(parsed);
          const arrangement = normalizeArrangement(parsed);

          const normalizedOutput: Record<string, unknown> = {
            composable: container ?? composable,
            modifierChain: modifiers.length > 0 ? `Modifier.${modifiers.join('.')}` : 'Modifier',
            ...arrangement,
          };

          const normalizedJson = JSON.stringify(normalizedOutput);

          await storage.put('normalizations', `${input.adapter}:${widgetType}`, {
            adapter: input.adapter,
            widgetType,
            composable: container ?? composable,
            normalized: normalizedJson,
          });

          return normalizeOk(input.adapter, normalizedJson);
        },
        storageError,
      ),
    ),
};
