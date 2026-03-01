// DesktopAdapter — Normalizes Clef widget props into generic desktop windowing primitives.
// Provides a platform-agnostic abstraction over desktop UI concepts like windows, panels,
// menus, toolbars, and status bars that concrete adapters (AppKit, GTK, WinUI) can consume.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DesktopAdapterStorage,
  DesktopAdapterNormalizeInput,
  DesktopAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface DesktopAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface DesktopAdapterHandler {
  readonly normalize: (
    input: DesktopAdapterNormalizeInput,
    storage: DesktopAdapterStorage,
  ) => TE.TaskEither<DesktopAdapterError, DesktopAdapterNormalizeOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): DesktopAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map of abstract widget types to generic desktop window component types. */
const WIDGET_TO_DESKTOP: Readonly<Record<string, string>> = {
  text: 'Label',
  button: 'Button',
  image: 'ImageView',
  container: 'Panel',
  scroll: 'ScrollPanel',
  list: 'ListView',
  input: 'TextInput',
  toggle: 'CheckBox',
  slider: 'Slider',
  progress: 'ProgressBar',
  divider: 'Separator',
  window: 'Window',
  dialog: 'Dialog',
  menu: 'Menu',
  menuItem: 'MenuItem',
  toolbar: 'ToolBar',
  statusbar: 'StatusBar',
  tab: 'TabPanel',
  tree: 'TreeView',
  table: 'TableView',
  split: 'SplitPanel',
  combo: 'ComboBox',
  spinner: 'Spinner',
};

/** Parse props JSON into a record. */
const parseProps = (props: string): Record<string, unknown> | null =>
  pipe(
    O.tryCatch(() => JSON.parse(props) as Record<string, unknown>),
    O.toNullable,
  );

/** Normalize abstract layout properties to desktop window manager hints. */
const normalizeLayout = (props: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};

  const width = props['width'] as number | undefined;
  const height = props['height'] as number | undefined;
  if (width !== undefined || height !== undefined) {
    normalized['preferredSize'] = { width: width ?? 400, height: height ?? 300 };
  }

  const minWidth = props['minWidth'] as number | undefined;
  const minHeight = props['minHeight'] as number | undefined;
  if (minWidth !== undefined || minHeight !== undefined) {
    normalized['minimumSize'] = { width: minWidth ?? 200, height: minHeight ?? 150 };
  }

  const resizable = props['resizable'] as boolean | undefined;
  if (resizable !== undefined) {
    normalized['resizable'] = resizable;
  }

  const direction = props['direction'] as string | undefined;
  if (direction !== undefined) {
    normalized['layoutDirection'] = direction;
  }

  const padding = props['padding'] as number | undefined;
  if (padding !== undefined) {
    normalized['insets'] = { top: padding, right: padding, bottom: padding, left: padding };
  }

  const spacing = props['spacing'] as number | undefined;
  if (spacing !== undefined) {
    normalized['componentSpacing'] = spacing;
  }

  return normalized;
};

/** Normalize abstract interaction properties to desktop event model. */
const normalizeInteraction = (props: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};
  const listeners: string[] = [];

  if (props['onClick'] !== undefined) listeners.push('ActionListener');
  if (props['onFocus'] !== undefined) listeners.push('FocusListener');
  if (props['onChange'] !== undefined) listeners.push('ChangeListener');
  if (props['onKeyDown'] !== undefined) listeners.push('KeyListener');
  if (props['onClose'] !== undefined) listeners.push('WindowListener');
  if (props['onResize'] !== undefined) listeners.push('ComponentListener');

  if (listeners.length > 0) {
    normalized['listeners'] = listeners;
  }

  const enabled = props['enabled'] as boolean | undefined;
  if (enabled !== undefined) normalized['enabled'] = enabled;

  const visible = props['visible'] as boolean | undefined;
  if (visible !== undefined) normalized['visible'] = visible;

  const focusable = props['focusable'] as boolean | undefined;
  if (focusable !== undefined) normalized['focusable'] = focusable;

  return normalized;
};

/** Normalize window decoration properties (title bar, frame, modality). */
const normalizeWindowDecoration = (props: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};

  const title = props['title'] as string | undefined;
  if (title !== undefined) normalized['title'] = title;

  const modal = props['modal'] as boolean | undefined;
  if (modal !== undefined) normalized['modal'] = modal;

  const alwaysOnTop = props['alwaysOnTop'] as boolean | undefined;
  if (alwaysOnTop !== undefined) normalized['alwaysOnTop'] = alwaysOnTop;

  const decorated = props['decorated'] as boolean | undefined;
  if (decorated !== undefined) normalized['decorated'] = decorated;

  return normalized;
};

// --- Implementation ---

export const desktopAdapterHandler: DesktopAdapterHandler = {
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
          const desktopComponent = WIDGET_TO_DESKTOP[widgetType.toLowerCase()];

          if (desktopComponent === undefined) {
            return normalizeError(
              `No desktop component mapping for widget type '${widgetType}'`,
            );
          }

          const layout = normalizeLayout(parsed);
          const interaction = normalizeInteraction(parsed);
          const decoration = normalizeWindowDecoration(parsed);

          const normalizedOutput: Record<string, unknown> = {
            component: desktopComponent,
            ...layout,
            ...interaction,
            ...decoration,
          };

          const normalizedJson = JSON.stringify(normalizedOutput);

          await storage.put('normalizations', `${input.adapter}:${widgetType}`, {
            adapter: input.adapter,
            widgetType,
            desktopComponent,
            normalized: normalizedJson,
          });

          return normalizeOk(input.adapter, normalizedJson);
        },
        storageError,
      ),
    ),
};
