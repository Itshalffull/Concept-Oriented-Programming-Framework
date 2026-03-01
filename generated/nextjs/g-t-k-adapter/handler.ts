// GTKAdapter — Normalizes Clef widget props into GTK4 widget equivalents.
// Maps abstract layout, typography, and interaction properties to GtkWidget subclasses,
// CSS node styling, and GObject signal connections.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  GTKAdapterStorage,
  GTKAdapterNormalizeInput,
  GTKAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface GTKAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface GTKAdapterHandler {
  readonly normalize: (
    input: GTKAdapterNormalizeInput,
    storage: GTKAdapterStorage,
  ) => TE.TaskEither<GTKAdapterError, GTKAdapterNormalizeOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): GTKAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Map of abstract widget types to their GTK4 widget class equivalents. */
const WIDGET_TO_GTK: Readonly<Record<string, string>> = {
  text: 'GtkLabel',
  button: 'GtkButton',
  image: 'GtkImage',
  container: 'GtkBox',
  scroll: 'GtkScrolledWindow',
  list: 'GtkListView',
  listItem: 'GtkListItem',
  input: 'GtkEntry',
  textarea: 'GtkTextView',
  toggle: 'GtkSwitch',
  checkbox: 'GtkCheckButton',
  slider: 'GtkScale',
  progress: 'GtkProgressBar',
  divider: 'GtkSeparator',
  grid: 'GtkGrid',
  stack: 'GtkStack',
  notebook: 'GtkNotebook',
  dialog: 'GtkDialog',
  window: 'GtkApplicationWindow',
  headerbar: 'GtkHeaderBar',
  menubar: 'GtkPopoverMenuBar',
  toolbar: 'GtkBox',
  popover: 'GtkPopover',
  revealer: 'GtkRevealer',
  expander: 'GtkExpander',
  spinner: 'GtkSpinner',
  levelbar: 'GtkLevelBar',
  searchbar: 'GtkSearchBar',
  flowbox: 'GtkFlowBox',
  paned: 'GtkPaned',
  dropdown: 'GtkDropDown',
  colorbutton: 'GtkColorButton',
  filechooser: 'GtkFileDialog',
};

/** Parse props JSON into a record. */
const parseProps = (props: string): Record<string, unknown> | null =>
  pipe(
    O.tryCatch(() => JSON.parse(props) as Record<string, unknown>),
    O.toNullable,
  );

/** Normalize abstract layout properties to GTK4 widget properties and CSS. */
const normalizeLayout = (props: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};
  const cssClasses: string[] = [];

  const direction = props['direction'] as string | undefined;
  if (direction !== undefined) {
    normalized['orientation'] = direction === 'horizontal'
      ? 'GTK_ORIENTATION_HORIZONTAL'
      : 'GTK_ORIENTATION_VERTICAL';
  }

  const spacing = props['spacing'] as number | undefined;
  if (spacing !== undefined) {
    normalized['spacing'] = spacing;
  }

  const padding = props['padding'] as number | undefined;
  if (padding !== undefined) {
    normalized['margin-top'] = padding;
    normalized['margin-bottom'] = padding;
    normalized['margin-start'] = padding;
    normalized['margin-end'] = padding;
  }

  const alignment = props['alignment'] as string | undefined;
  if (alignment !== undefined) {
    const hAlignMap: Record<string, string> = {
      start: 'GTK_ALIGN_START',
      center: 'GTK_ALIGN_CENTER',
      end: 'GTK_ALIGN_END',
      stretch: 'GTK_ALIGN_FILL',
    };
    normalized['halign'] = hAlignMap[alignment] ?? 'GTK_ALIGN_START';
  }

  const vAlignment = props['vAlignment'] as string | undefined;
  if (vAlignment !== undefined) {
    const vAlignMap: Record<string, string> = {
      start: 'GTK_ALIGN_START',
      center: 'GTK_ALIGN_CENTER',
      end: 'GTK_ALIGN_END',
      stretch: 'GTK_ALIGN_FILL',
    };
    normalized['valign'] = vAlignMap[vAlignment] ?? 'GTK_ALIGN_START';
  }

  const hexpand = props['hexpand'] as boolean | undefined;
  if (hexpand !== undefined) normalized['hexpand'] = hexpand;

  const vexpand = props['vexpand'] as boolean | undefined;
  if (vexpand !== undefined) normalized['vexpand'] = vexpand;

  const width = props['width'] as number | undefined;
  if (width !== undefined) normalized['width-request'] = width;

  const height = props['height'] as number | undefined;
  if (height !== undefined) normalized['height-request'] = height;

  if (cssClasses.length > 0) {
    normalized['cssClasses'] = cssClasses;
  }

  return normalized;
};

/** Normalize abstract interaction properties to GTK4 GObject signals. */
const normalizeSignals = (props: Record<string, unknown>): Record<string, string> => {
  const signals: Record<string, string> = {};

  if (props['onClick'] !== undefined) signals['clicked'] = 'on_clicked';
  if (props['onActivate'] !== undefined) signals['activate'] = 'on_activate';
  if (props['onChange'] !== undefined) signals['changed'] = 'on_changed';
  if (props['onToggle'] !== undefined) signals['state-set'] = 'on_state_set';
  if (props['onFocus'] !== undefined) signals['enter'] = 'on_enter';
  if (props['onBlur'] !== undefined) signals['leave'] = 'on_leave';
  if (props['onKeyDown'] !== undefined) signals['key-pressed'] = 'on_key_pressed';
  if (props['onClose'] !== undefined) signals['close-request'] = 'on_close_request';
  if (props['onResize'] !== undefined) signals['notify::default-width'] = 'on_resize';

  return signals;
};

/** Normalize accessibility properties to GTK4 accessible roles and properties. */
const normalizeAccessibility = (props: Record<string, unknown>): Record<string, unknown> => {
  const accessible: Record<string, unknown> = {};

  const label = props['accessibilityLabel'] as string | undefined;
  if (label !== undefined) accessible['accessible-label'] = label;

  const role = props['role'] as string | undefined;
  if (role !== undefined) {
    const roleMap: Record<string, string> = {
      button: 'GTK_ACCESSIBLE_ROLE_BUTTON',
      heading: 'GTK_ACCESSIBLE_ROLE_HEADING',
      list: 'GTK_ACCESSIBLE_ROLE_LIST',
      listitem: 'GTK_ACCESSIBLE_ROLE_LIST_ITEM',
      dialog: 'GTK_ACCESSIBLE_ROLE_DIALOG',
      img: 'GTK_ACCESSIBLE_ROLE_IMG',
      form: 'GTK_ACCESSIBLE_ROLE_FORM',
    };
    accessible['accessible-role'] = roleMap[role.toLowerCase()] ?? role;
  }

  return accessible;
};

// --- Implementation ---

export const gTKAdapterHandler: GTKAdapterHandler = {
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
          const gtkWidget = WIDGET_TO_GTK[widgetType.toLowerCase()];

          if (gtkWidget === undefined) {
            return normalizeError(
              `No GTK4 widget mapping for widget type '${widgetType}'`,
            );
          }

          const layout = normalizeLayout(parsed);
          const signals = normalizeSignals(parsed);
          const accessibility = normalizeAccessibility(parsed);

          const normalizedOutput: Record<string, unknown> = {
            widget: gtkWidget,
            properties: layout,
            signals,
            accessibility,
          };

          // Include the widget's sensitive (enabled) state
          const enabled = parsed['enabled'] as boolean | undefined;
          if (enabled !== undefined) {
            (normalizedOutput['properties'] as Record<string, unknown>)['sensitive'] = enabled;
          }

          const visible = parsed['visible'] as boolean | undefined;
          if (visible !== undefined) {
            (normalizedOutput['properties'] as Record<string, unknown>)['visible'] = visible;
          }

          const normalizedJson = JSON.stringify(normalizedOutput);

          await storage.put('normalizations', `${input.adapter}:${widgetType}`, {
            adapter: input.adapter,
            widgetType,
            gtkWidget,
            normalized: normalizedJson,
          });

          return normalizeOk(input.adapter, normalizedJson);
        },
        storageError,
      ),
    ),
};
