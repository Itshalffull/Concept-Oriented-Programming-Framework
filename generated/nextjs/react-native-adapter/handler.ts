// ReactNativeAdapter — handler.ts
// React Native platform adapter: normalizes widget props into React Native
// component representations. Maps CSS/HTML props to RN StyleSheet conventions,
// replaces DOM elements with RN primitives (View, Text, Image, ScrollView),
// and enforces platform-specific constraints (no CSS cascade, no DOM events).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ReactNativeAdapterStorage,
  ReactNativeAdapterNormalizeInput,
  ReactNativeAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface ReactNativeAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface ReactNativeAdapterHandler {
  readonly normalize: (
    input: ReactNativeAdapterNormalizeInput,
    storage: ReactNativeAdapterStorage,
  ) => TE.TaskEither<ReactNativeAdapterError, ReactNativeAdapterNormalizeOutput>;
}

// --- React Native component mapping ---

/** Map DOM/HTML element names to React Native primitives */
const DOM_TO_RN: Readonly<Record<string, string>> = {
  'div': 'View',
  'span': 'Text',
  'p': 'Text',
  'h1': 'Text',
  'h2': 'Text',
  'h3': 'Text',
  'img': 'Image',
  'button': 'Pressable',
  'input': 'TextInput',
  'textarea': 'TextInput',
  'ul': 'FlatList',
  'ol': 'FlatList',
  'a': 'Pressable',
  'section': 'View',
  'article': 'View',
  'nav': 'View',
  'header': 'View',
  'footer': 'View',
  'main': 'View',
};

/** React Native core components */
const RN_PRIMITIVES: ReadonlySet<string> = new Set([
  'View', 'Text', 'Image', 'ScrollView', 'FlatList', 'SectionList',
  'TextInput', 'Pressable', 'TouchableOpacity', 'TouchableHighlight',
  'Modal', 'ActivityIndicator', 'StatusBar', 'SafeAreaView',
  'KeyboardAvoidingView', 'Switch', 'Animated',
]);

/** CSS props that are NOT supported in React Native */
const UNSUPPORTED_CSS: ReadonlySet<string> = new Set([
  'float', 'clear', 'display', 'position', 'z-index', 'cursor',
  'transition', 'animation', 'transform-origin', 'box-shadow',
  'text-decoration', 'list-style', 'content',
]);

/** Min touch target size (dp) per platform guidelines */
const MIN_TOUCH_SIZE = 44;

const storageError = (error: unknown): ReactNativeAdapterError => ({
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

/** Convert kebab-case to camelCase */
const kebabToCamel = (s: string): string =>
  s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Filter out unsupported CSS props and convert remaining to camelCase */
const normalizeStyleProps = (props: Readonly<Record<string, unknown>>): {
  readonly style: Record<string, unknown>;
  readonly rest: Record<string, unknown>;
} => {
  const style: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (UNSUPPORTED_CSS.has(key)) {
      warnings.push(key);
    } else if (key.includes('-')) {
      style[kebabToCamel(key)] = value;
    } else if (key === 'className' || key === 'class') {
      // React Native does not support className
      warnings.push(key);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(style, value);
    } else if (key.startsWith('on') || key === 'ref' || key === 'key' || key === 'testID') {
      rest[key] = value;
    } else if (['flex', 'flexDirection', 'alignItems', 'justifyContent',
      'width', 'height', 'margin', 'padding', 'backgroundColor',
      'borderRadius', 'borderWidth', 'borderColor', 'opacity',
      'fontSize', 'fontWeight', 'color', 'lineHeight', 'textAlign',
      'position', 'top', 'left', 'right', 'bottom'].includes(key)) {
      style[key] = value;
    } else {
      rest[key] = value;
    }
  }

  if (warnings.length > 0) {
    rest['_rnWarnings'] = warnings;
  }

  return { style, rest };
};

/** Enforce minimum touch target on interactive components */
const enforceTouchTarget = (
  style: Record<string, unknown>,
  isInteractive: boolean,
): Record<string, unknown> => {
  if (!isInteractive) return style;
  const result = { ...style };
  const w = typeof result['minWidth'] === 'number' ? result['minWidth'] as number : 0;
  const h = typeof result['minHeight'] === 'number' ? result['minHeight'] as number : 0;
  if (w < MIN_TOUCH_SIZE) result['minWidth'] = MIN_TOUCH_SIZE;
  if (h < MIN_TOUCH_SIZE) result['minHeight'] = MIN_TOUCH_SIZE;
  return result;
};

/** Resolve the target RN component from an adapter string */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const raw = parts[parts.length - 1] ?? 'div';
  if (RN_PRIMITIVES.has(raw)) return raw;
  const mapped = DOM_TO_RN[raw.toLowerCase()];
  return mapped ?? 'View';
};

/** Detect if component is interactive */
const isInteractive = (component: string): boolean =>
  component === 'Pressable' || component === 'TouchableOpacity' ||
  component === 'TouchableHighlight' || component === 'TextInput' ||
  component === 'Switch';

// --- Implementation ---

export const reactNativeAdapterHandler: ReactNativeAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);
          const interactive = isInteractive(component);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for React Native adapter "${input.adapter}"`),
              (parsed) => {
                const { style, rest } = normalizeStyleProps(parsed);
                const touchSafeStyle = enforceTouchTarget(style, interactive);
                const hasStyle = Object.keys(touchSafeStyle).length > 0;

                const finalProps: Record<string, unknown> = { ...rest };
                if (hasStyle) finalProps['style'] = touchSafeStyle;

                const normalized = JSON.stringify({
                  component,
                  props: finalProps,
                  platform: 'react-native',
                  runtime: 'hermes',
                  interactive,
                  nativeModule: false,
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
                  await storage.put('reactnativeadapter', input.adapter, {
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
