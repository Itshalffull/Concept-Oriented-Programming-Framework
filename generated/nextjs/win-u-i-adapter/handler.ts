// WinUIAdapter — handler.ts
// WinUI/XAML adapter: normalizes widget props into WinUI 3 XAML control
// representations. Maps to WinUI controls (StackPanel, Grid, Button,
// TextBlock, NavigationView), handles XAML attached properties, resource
// references ({StaticResource}, {ThemeResource}), and Windows design tokens.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WinUIAdapterStorage,
  WinUIAdapterNormalizeInput,
  WinUIAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface WinUIAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface WinUIAdapterHandler {
  readonly normalize: (
    input: WinUIAdapterNormalizeInput,
    storage: WinUIAdapterStorage,
  ) => TE.TaskEither<WinUIAdapterError, WinUIAdapterNormalizeOutput>;
}

// --- WinUI/XAML component mapping ---

/** WinUI layout panels */
const WINUI_PANELS: ReadonlySet<string> = new Set([
  'StackPanel', 'Grid', 'RelativePanel', 'Canvas',
  'Border', 'ScrollViewer', 'Viewbox', 'WrapPanel',
]);

/** WinUI control types */
const WINUI_CONTROLS: ReadonlySet<string> = new Set([
  'Button', 'TextBlock', 'TextBox', 'PasswordBox', 'RichTextBlock',
  'Image', 'CheckBox', 'RadioButton', 'ToggleSwitch', 'Slider',
  'ProgressBar', 'ProgressRing', 'ComboBox', 'ListView', 'GridView',
  'NavigationView', 'TabView', 'InfoBar', 'TeachingTip',
  'ContentDialog', 'MenuBar', 'CommandBar', 'AppBarButton',
  'HyperlinkButton', 'DropDownButton', 'SplitButton', 'CalendarView',
  'DatePicker', 'TimePicker', 'PersonPicture', 'RatingControl',
  'TreeView', 'Expander', 'BreadcrumbBar', 'NumberBox',
]);

/** Map CSS-like flex-direction to WinUI panel orientation */
const FLEX_TO_ORIENTATION: Readonly<Record<string, string>> = {
  'column': 'Vertical',
  'vertical': 'Vertical',
  'row': 'Horizontal',
  'horizontal': 'Horizontal',
};

/** Map generic layout props to XAML properties */
const PROP_MAP: Readonly<Record<string, string>> = {
  'background-color': 'Background',
  'backgroundColor': 'Background',
  'color': 'Foreground',
  'font-size': 'FontSize',
  'fontSize': 'FontSize',
  'font-weight': 'FontWeight',
  'fontWeight': 'FontWeight',
  'width': 'Width',
  'height': 'Height',
  'margin': 'Margin',
  'padding': 'Padding',
  'opacity': 'Opacity',
  'border-radius': 'CornerRadius',
  'borderRadius': 'CornerRadius',
  'border-width': 'BorderThickness',
  'borderWidth': 'BorderThickness',
  'text-align': 'TextAlignment',
  'textAlign': 'TextAlignment',
  'visibility': 'Visibility',
  'disabled': 'IsEnabled',
  'text': 'Text',
  'content': 'Content',
  'placeholder': 'PlaceholderText',
};

/** XAML HorizontalAlignment values */
const H_ALIGNMENT: ReadonlySet<string> = new Set(['Left', 'Center', 'Right', 'Stretch']);

/** XAML VerticalAlignment values */
const V_ALIGNMENT: ReadonlySet<string> = new Set(['Top', 'Center', 'Bottom', 'Stretch']);

const storageError = (error: unknown): WinUIAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const parseProps = (raw: string): O.Option<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? O.some(parsed as Record<string, unknown>)
      : O.none;
  } catch {
    return O.none;
  }
};

/** Transform generic props to XAML property equivalents */
const transformToXAML = (
  props: Readonly<Record<string, unknown>>,
): {
  readonly properties: Record<string, unknown>;
  readonly attachedProps: Record<string, unknown>;
} => {
  const properties: Record<string, unknown> = {};
  const attachedProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const xamlProp = PROP_MAP[key];
    if (xamlProp !== undefined) {
      // Invert 'disabled' to WinUI IsEnabled
      if (key === 'disabled') {
        properties['IsEnabled'] = !value;
      } else {
        properties[xamlProp] = value;
      }
      continue;
    }

    if (key === 'flex-direction' || key === 'flexDirection') {
      const orientation = typeof value === 'string' ? FLEX_TO_ORIENTATION[value] : undefined;
      if (orientation !== undefined) properties['Orientation'] = orientation;
      continue;
    }

    // Grid attached properties
    if (key === 'row' || key === 'Grid.Row') {
      attachedProps['Grid.Row'] = value;
      continue;
    }
    if (key === 'col' || key === 'column' || key === 'Grid.Column') {
      attachedProps['Grid.Column'] = value;
      continue;
    }
    if (key === 'rowSpan' || key === 'Grid.RowSpan') {
      attachedProps['Grid.RowSpan'] = value;
      continue;
    }
    if (key === 'colSpan' || key === 'columnSpan' || key === 'Grid.ColumnSpan') {
      attachedProps['Grid.ColumnSpan'] = value;
      continue;
    }

    // Alignment
    if (key === 'horizontalAlignment' || key === 'hAlign') {
      const val = typeof value === 'string' ? capitalize(value) : 'Stretch';
      if (H_ALIGNMENT.has(val)) properties['HorizontalAlignment'] = val;
      continue;
    }
    if (key === 'verticalAlignment' || key === 'vAlign') {
      const val = typeof value === 'string' ? capitalize(value) : 'Stretch';
      if (V_ALIGNMENT.has(val)) properties['VerticalAlignment'] = val;
      continue;
    }

    // Grid row/column definitions
    if (key === 'rows' || key === 'RowDefinitions') {
      properties['RowDefinitions'] = value;
      continue;
    }
    if (key === 'columns' || key === 'ColumnDefinitions') {
      properties['ColumnDefinitions'] = value;
      continue;
    }

    // Pass through other props
    properties[key] = value;
  }

  return { properties, attachedProps };
};

/** Capitalize first letter */
const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/** Resolve WinUI control from adapter string */
const resolveControl = (adapter: string): string => {
  const parts = adapter.split('/');
  const raw = parts[parts.length - 1] ?? 'StackPanel';
  if (WINUI_PANELS.has(raw)) return raw;
  if (WINUI_CONTROLS.has(raw)) return raw;
  return 'StackPanel';
};

// --- Implementation ---

export const winUIAdapterHandler: WinUIAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const control = resolveControl(input.adapter);
          const isPanel = WINUI_PANELS.has(control);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for WinUI adapter "${input.adapter}"`),
              (parsed) => {
                const { properties, attachedProps } = transformToXAML(parsed);
                const hasAttached = Object.keys(attachedProps).length > 0;

                const normalized = JSON.stringify({
                  control,
                  properties,
                  ...(hasAttached ? { attachedProperties: attachedProps } : {}),
                  platform: 'winui',
                  runtime: 'windows',
                  xamlNamespace: 'Microsoft.UI.Xaml.Controls',
                  isPanel,
                  designSystem: 'fluent',
                });
                return normalizeOk(input.adapter, normalized);
              },
            ),
          );
        },
        storageError,
      ),
      TE.chain((result) =>
        result.variant === 'error'
          ? TE.right(result)
          : pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('winuiadapter', input.adapter, {
                    adapter: input.adapter,
                    normalized: result.normalized,
                    timestamp: Date.now(),
                  });
                  return result;
                },
                storageError,
              ),
            ),
      ),
    ),
};
