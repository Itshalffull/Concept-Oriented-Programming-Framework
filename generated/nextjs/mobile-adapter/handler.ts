// MobileAdapter — handler.ts
// Generic mobile UI adapter: normalizes widget props into a platform-agnostic
// mobile component representation. Handles touch target enforcement, safe area
// awareness, dp-unit annotation, and responsive layout for iOS/Android surfaces.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MobileAdapterStorage,
  MobileAdapterNormalizeInput,
  MobileAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface MobileAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface MobileAdapterHandler {
  readonly normalize: (
    input: MobileAdapterNormalizeInput,
    storage: MobileAdapterStorage,
  ) => TE.TaskEither<MobileAdapterError, MobileAdapterNormalizeOutput>;
}

// --- Mobile platform constants ---

/** Minimum touch target size in dp per Material Design / Apple HIG guidelines */
const MIN_TOUCH_TARGET_DP = 44;

/** Mobile layout primitives that pass through without remapping */
const MOBILE_PRIMITIVES: ReadonlySet<string> = new Set([
  'View', 'ScrollView', 'FlatList', 'TouchableOpacity',
  'SafeAreaView', 'Modal', 'ActivityIndicator', 'StatusBar',
]);

/** CSS-like prop keys that need camelCase normalization for mobile */
const CSS_TO_MOBILE: Readonly<Record<string, string>> = {
  'flex-direction': 'flexDirection',
  'align-items': 'alignItems',
  'justify-content': 'justifyContent',
  'background-color': 'backgroundColor',
  'border-radius': 'borderRadius',
  'font-size': 'fontSize',
  'line-height': 'lineHeight',
  'font-weight': 'fontWeight',
  'text-align': 'textAlign',
  'min-width': 'minWidth',
  'min-height': 'minHeight',
  'max-width': 'maxWidth',
  'max-height': 'maxHeight',
};

/** Props that carry numeric dp values needing scaling annotation */
const SCALABLE_PROPS: ReadonlySet<string> = new Set([
  'width', 'height', 'padding', 'margin', 'borderRadius',
  'fontSize', 'lineHeight', 'minWidth', 'minHeight',
]);

const storageError = (error: unknown): MobileAdapterError => ({
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

/** Normalize CSS-like prop names to mobile camelCase equivalents */
const normalizePropNames = (props: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const mapped = CSS_TO_MOBILE[key];
    result[mapped ?? key] = value;
  }
  return result;
};

/** Enforce minimum touch target dimensions for interactive elements */
const enforceTouchTargets = (
  props: Record<string, unknown>,
  interactive: boolean,
): Record<string, unknown> => {
  if (!interactive) return props;
  const result = { ...props };
  const minW = typeof result['minWidth'] === 'number' ? result['minWidth'] as number : 0;
  const minH = typeof result['minHeight'] === 'number' ? result['minHeight'] as number : 0;
  if (minW < MIN_TOUCH_TARGET_DP) result['minWidth'] = MIN_TOUCH_TARGET_DP;
  if (minH < MIN_TOUCH_TARGET_DP) result['minHeight'] = MIN_TOUCH_TARGET_DP;
  return result;
};

/** Tag numeric layout props with dp unit annotation for density scaling */
const annotateDpUnits = (props: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (SCALABLE_PROPS.has(key) && typeof value === 'number') {
      result[key] = { value, unit: 'dp' };
    } else {
      result[key] = value;
    }
  }
  return result;
};

/** Detect interactive component from adapter name */
const isInteractive = (adapter: string): boolean => {
  const lower = adapter.toLowerCase();
  return lower.includes('button') || lower.includes('touchable') ||
    lower.includes('pressable') || lower.includes('link');
};

/** Resolve which mobile primitive component to target */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'View';
  return MOBILE_PRIMITIVES.has(component) ? component : 'View';
};

// --- Implementation ---

export const mobileAdapterHandler: MobileAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);
          const interactive = isInteractive(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for mobile adapter "${input.adapter}"`),
              (parsed) => {
                const camelProps = normalizePropNames(parsed);
                const touchSafe = enforceTouchTargets(camelProps, interactive);
                const annotated = annotateDpUnits(touchSafe);
                const normalized = JSON.stringify({
                  component,
                  props: annotated,
                  platform: 'mobile',
                  safeArea: true,
                  interactive,
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
                  await storage.put('mobileadapter', input.adapter, {
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
