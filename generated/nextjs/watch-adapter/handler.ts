// WatchAdapter — handler.ts
// Wearable/watch UI adapter: normalizes widget props into watch-optimized
// component representations. Enforces small-screen constraints (circular/square
// display), simplified navigation (crown, gestures), glanceable content limits,
// and power-aware rendering strategies for wearable devices.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WatchAdapterStorage,
  WatchAdapterNormalizeInput,
  WatchAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface WatchAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface WatchAdapterHandler {
  readonly normalize: (
    input: WatchAdapterNormalizeInput,
    storage: WatchAdapterStorage,
  ) => TE.TaskEither<WatchAdapterError, WatchAdapterNormalizeOutput>;
}

// --- Wearable display constraints ---

/** Maximum recommended content elements for a watch glance */
const MAX_GLANCE_ITEMS = 5;

/** Watch display form factors */
type WatchFormFactor = 'circular' | 'square' | 'rectangular';

/** Common watch display sizes in pixels */
const DISPLAY_SIZES: Readonly<Record<string, { readonly width: number; readonly height: number }>> = {
  'small': { width: 162, height: 162 },
  'medium': { width: 184, height: 224 },
  'large': { width: 198, height: 242 },
};

/** Watch UI component primitives */
const WATCH_COMPONENTS: ReadonlySet<string> = new Set([
  'Card', 'List', 'Button', 'Text', 'Image', 'Complication',
  'Gauge', 'ProgressView', 'Timer', 'Notification', 'Glance',
  'DigitalCrown', 'PageView',
]);

/** Min touch target size on watch (smaller than phone, per guidelines) */
const MIN_WATCH_TOUCH_TARGET = 38;

const storageError = (error: unknown): WatchAdapterError => ({
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

/** Determine form factor from props or default */
const resolveFormFactor = (props: Readonly<Record<string, unknown>>): WatchFormFactor => {
  const formFactor = props['formFactor'] ?? props['form-factor'];
  if (formFactor === 'circular' || formFactor === 'square' || formFactor === 'rectangular') {
    return formFactor;
  }
  return 'rectangular';
};

/** Resolve display dimensions */
const resolveDisplaySize = (props: Readonly<Record<string, unknown>>): { readonly width: number; readonly height: number } => {
  const size = typeof props['displaySize'] === 'string' ? props['displaySize'] : 'medium';
  return DISPLAY_SIZES[size] ?? DISPLAY_SIZES['medium']!;
};

/** Constrain props for watch display limitations */
const constrainForWatch = (
  props: Readonly<Record<string, unknown>>,
  display: { readonly width: number; readonly height: number },
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === 'width' && typeof value === 'number') {
      result[key] = Math.min(value, display.width);
    } else if (key === 'height' && typeof value === 'number') {
      result[key] = Math.min(value, display.height);
    } else if (key === 'fontSize' || key === 'font-size') {
      // Cap font size for readability on small screens
      const numVal = typeof value === 'number' ? value : 14;
      result['fontSize'] = Math.min(Math.max(numVal, 10), 24);
    } else if (key === 'padding' || key === 'margin') {
      // Reduce spacing for small screens
      const numVal = typeof value === 'number' ? value : 4;
      result[key] = Math.min(numVal, 12);
    } else if (key === 'formFactor' || key === 'form-factor' || key === 'displaySize') {
      // Meta props consumed above, not passed through
    } else {
      result[key] = value;
    }
  }

  return result;
};

/** Enforce minimum touch target for interactive elements */
const enforceTouchTarget = (
  props: Record<string, unknown>,
  interactive: boolean,
): Record<string, unknown> => {
  if (!interactive) return props;
  const result = { ...props };
  const w = typeof result['minWidth'] === 'number' ? result['minWidth'] as number : 0;
  const h = typeof result['minHeight'] === 'number' ? result['minHeight'] as number : 0;
  if (w < MIN_WATCH_TOUCH_TARGET) result['minWidth'] = MIN_WATCH_TOUCH_TARGET;
  if (h < MIN_WATCH_TOUCH_TARGET) result['minHeight'] = MIN_WATCH_TOUCH_TARGET;
  return result;
};

/** Resolve watch component from adapter string */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'Card';
  return WATCH_COMPONENTS.has(component) ? component : 'Card';
};

const isInteractive = (component: string): boolean =>
  component === 'Button' || component === 'DigitalCrown';

// --- Implementation ---

export const watchAdapterHandler: WatchAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);
          const interactive = isInteractive(component);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for watch adapter "${input.adapter}"`),
              (parsed) => {
                const formFactor = resolveFormFactor(parsed);
                const display = resolveDisplaySize(parsed);
                const constrained = constrainForWatch(parsed, display);
                const touchSafe = enforceTouchTarget(constrained, interactive);

                const normalized = JSON.stringify({
                  component,
                  props: touchSafe,
                  platform: 'watch',
                  formFactor,
                  display,
                  maxGlanceItems: MAX_GLANCE_ITEMS,
                  interactive,
                  powerAware: true,
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
                  await storage.put('watchadapter', input.adapter, {
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
