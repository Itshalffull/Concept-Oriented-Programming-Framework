// NativeScriptAdapter — handler.ts
// NativeScript platform adapter: normalizes widget props into NativeScript-native
// XML view components. Maps CSS-like properties to NativeScript layout conventions
// (StackLayout, GridLayout, FlexboxLayout) and native view attributes.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  NativeScriptAdapterStorage,
  NativeScriptAdapterNormalizeInput,
  NativeScriptAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface NativeScriptAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface NativeScriptAdapterHandler {
  readonly normalize: (
    input: NativeScriptAdapterNormalizeInput,
    storage: NativeScriptAdapterStorage,
  ) => TE.TaskEither<NativeScriptAdapterError, NativeScriptAdapterNormalizeOutput>;
}

// --- NativeScript layout mapping ---

/** NativeScript view/layout components */
const NS_LAYOUTS: ReadonlySet<string> = new Set([
  'StackLayout', 'GridLayout', 'FlexboxLayout', 'WrapLayout',
  'AbsoluteLayout', 'DockLayout', 'RootLayout',
]);

const NS_VIEWS: ReadonlySet<string> = new Set([
  'Label', 'Button', 'TextField', 'TextView', 'Image',
  'ListView', 'ScrollView', 'WebView', 'ActivityIndicator',
  'Switch', 'Slider', 'Progress', 'DatePicker', 'TimePicker',
  'ListPicker', 'SegmentedBar', 'TabView', 'ActionBar',
]);

/** Map CSS flex-direction to NativeScript StackLayout orientation */
const resolveOrientation = (direction: unknown): string =>
  direction === 'row' || direction === 'horizontal' ? 'horizontal' : 'vertical';

/** Map generic layout props to NativeScript XML attributes */
const PROP_MAP: Readonly<Record<string, string>> = {
  'background-color': 'backgroundColor',
  'background': 'backgroundColor',
  'color': 'color',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'text-align': 'textAlignment',
  'border-radius': 'borderRadius',
  'border-color': 'borderColor',
  'border-width': 'borderWidth',
  'width': 'width',
  'height': 'height',
  'margin': 'margin',
  'padding': 'padding',
  'opacity': 'opacity',
  'visibility': 'visibility',
};

const storageError = (error: unknown): NativeScriptAdapterError => ({
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

/** Transform generic widget props to NativeScript view attributes */
const transformToNSProps = (props: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const layoutMeta: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const mapped = PROP_MAP[key];
    if (mapped !== undefined) {
      result[mapped] = value;
    } else if (key === 'flex-direction' || key === 'flexDirection') {
      layoutMeta['orientation'] = resolveOrientation(value);
    } else if (key === 'rows' || key === 'columns') {
      // GridLayout row/column definitions
      layoutMeta[key] = value;
    } else if (key === 'dock') {
      // DockLayout child docking
      result['dock'] = value;
    } else if (key === 'row' || key === 'col' || key === 'rowSpan' || key === 'colSpan') {
      // GridLayout child positioning
      result[key] = value;
    } else if (key === 'horizontalAlignment' || key === 'verticalAlignment') {
      result[key] = value;
    } else {
      result[key] = value;
    }
  }

  return { ...result, ...layoutMeta };
};

/** Resolve the target NativeScript component */
const resolveNSComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'StackLayout';
  if (NS_LAYOUTS.has(component)) return component;
  if (NS_VIEWS.has(component)) return component;
  return 'StackLayout';
};

// --- Implementation ---

export const nativeScriptAdapterHandler: NativeScriptAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveNSComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for NativeScript adapter "${input.adapter}"`),
              (parsed) => {
                const nsProps = transformToNSProps(parsed);
                const normalized = JSON.stringify({
                  component,
                  props: nsProps,
                  platform: 'nativescript',
                  runtime: 'nativescript',
                  viewType: NS_LAYOUTS.has(component) ? 'layout' : 'view',
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
                  await storage.put('nativescriptadapter', input.adapter, {
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
