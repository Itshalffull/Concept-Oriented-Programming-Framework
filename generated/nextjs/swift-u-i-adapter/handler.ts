// SwiftUIAdapter — handler.ts
// SwiftUI platform adapter: normalizes widget props into SwiftUI view
// representations. Maps layout to SwiftUI modifiers (padding, frame, background),
// resolves view types (VStack, HStack, ZStack, List, NavigationStack),
// and annotates property wrappers (@State, @Binding, @ObservedObject).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SwiftUIAdapterStorage,
  SwiftUIAdapterNormalizeInput,
  SwiftUIAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface SwiftUIAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface SwiftUIAdapterHandler {
  readonly normalize: (
    input: SwiftUIAdapterNormalizeInput,
    storage: SwiftUIAdapterStorage,
  ) => TE.TaskEither<SwiftUIAdapterError, SwiftUIAdapterNormalizeOutput>;
}

// --- SwiftUI view and modifier mapping ---

/** SwiftUI layout container views */
const SWIFTUI_CONTAINERS: ReadonlySet<string> = new Set([
  'VStack', 'HStack', 'ZStack', 'LazyVStack', 'LazyHStack',
  'LazyVGrid', 'LazyHGrid', 'List', 'ScrollView', 'Form',
  'Group', 'Section', 'NavigationStack', 'NavigationSplitView',
  'TabView', 'GeometryReader',
]);

/** SwiftUI primitive views */
const SWIFTUI_PRIMITIVES: ReadonlySet<string> = new Set([
  'Text', 'Image', 'Button', 'Toggle', 'Slider', 'Stepper',
  'TextField', 'SecureField', 'TextEditor', 'Picker', 'DatePicker',
  'ColorPicker', 'ProgressView', 'Link', 'Label', 'Spacer', 'Divider',
  'Rectangle', 'Circle', 'Capsule', 'RoundedRectangle', 'Ellipse',
]);

/** Map CSS-like flex-direction to SwiftUI stack type */
const FLEX_TO_STACK: Readonly<Record<string, string>> = {
  'column': 'VStack',
  'vertical': 'VStack',
  'row': 'HStack',
  'horizontal': 'HStack',
  'z': 'ZStack',
  'overlay': 'ZStack',
};

/** Map generic layout props to SwiftUI view modifiers */
const PROP_TO_MODIFIER: Readonly<Record<string, string>> = {
  'padding': '.padding',
  'background-color': '.background',
  'backgroundColor': '.background',
  'opacity': '.opacity',
  'border-radius': '.cornerRadius',
  'borderRadius': '.cornerRadius',
  'color': '.foregroundColor',
  'font-size': '.font',
  'fontSize': '.font',
  'width': '.frame(width:)',
  'height': '.frame(height:)',
  'shadow': '.shadow',
  'disabled': '.disabled',
  'hidden': '.hidden',
};

/** SwiftUI property wrapper annotations */
const PROPERTY_WRAPPERS: ReadonlySet<string> = new Set([
  '@State', '@Binding', '@ObservedObject', '@StateObject',
  '@EnvironmentObject', '@Environment', '@Published', '@AppStorage',
]);

const storageError = (error: unknown): SwiftUIAdapterError => ({
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

/** Transform props into SwiftUI modifiers and view parameters */
const transformToSwiftUI = (
  props: Readonly<Record<string, unknown>>,
): {
  readonly modifiers: readonly { readonly name: string; readonly value: unknown }[];
  readonly viewParams: Record<string, unknown>;
  readonly propertyWrappers: readonly string[];
} => {
  const modifiers: { readonly name: string; readonly value: unknown }[] = [];
  const viewParams: Record<string, unknown> = {};
  const propertyWrappers: string[] = [];

  // Collect frame dimensions to combine into single .frame modifier
  let frameWidth: unknown = undefined;
  let frameHeight: unknown = undefined;

  for (const [key, value] of Object.entries(props)) {
    const modifier = PROP_TO_MODIFIER[key];

    if (key === 'width') {
      frameWidth = value;
    } else if (key === 'height') {
      frameHeight = value;
    } else if (modifier !== undefined) {
      modifiers.push({ name: modifier, value });
    } else if (key === 'alignment') {
      viewParams['alignment'] = value;
    } else if (key === 'spacing') {
      viewParams['spacing'] = value;
    } else if (key === 'flex-direction' || key === 'flexDirection') {
      // Handled at component resolution level
    } else if (typeof key === 'string' && PROPERTY_WRAPPERS.has(key)) {
      propertyWrappers.push(key);
    } else if (key.startsWith('@')) {
      propertyWrappers.push(key);
    } else if (key === 'action' || key === 'label' || key === 'content' || key === 'text') {
      viewParams[key] = value;
    } else {
      viewParams[key] = value;
    }
  }

  // Combine width/height into a single .frame modifier
  if (frameWidth !== undefined || frameHeight !== undefined) {
    const frameValue: Record<string, unknown> = {};
    if (frameWidth !== undefined) frameValue['width'] = frameWidth;
    if (frameHeight !== undefined) frameValue['height'] = frameHeight;
    modifiers.push({ name: '.frame', value: frameValue });
  }

  return { modifiers, viewParams, propertyWrappers };
};

/** Resolve SwiftUI view from adapter string and props */
const resolveView = (adapter: string, props: Readonly<Record<string, unknown>>): string => {
  const parts = adapter.split('/');
  const raw = parts[parts.length - 1] ?? 'VStack';

  if (SWIFTUI_CONTAINERS.has(raw)) return raw;
  if (SWIFTUI_PRIMITIVES.has(raw)) return raw;

  // Infer stack type from flex-direction
  const direction = props['flex-direction'] ?? props['flexDirection'];
  if (typeof direction === 'string') {
    const stack = FLEX_TO_STACK[direction];
    if (stack !== undefined) return stack;
  }

  return 'VStack';
};

// --- Implementation ---

export const swiftUIAdapterHandler: SwiftUIAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () =>
          pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for SwiftUI adapter "${input.adapter}"`),
              (parsed) => {
                const view = resolveView(input.adapter, parsed);
                const { modifiers, viewParams, propertyWrappers } = transformToSwiftUI(parsed);
                const isContainer = SWIFTUI_CONTAINERS.has(view);

                const normalized = JSON.stringify({
                  view,
                  modifiers,
                  viewParams,
                  platform: 'swiftui',
                  runtime: 'apple',
                  isContainer,
                  propertyWrappers,
                  declarativeUI: true,
                });
                return normalizeOk(input.adapter, normalized);
              },
            ),
          ),
        storageError,
      ),
      TE.chain((result) =>
        result.variant === 'error'
          ? TE.right(result)
          : pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('swiftuiadapter', input.adapter, {
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
