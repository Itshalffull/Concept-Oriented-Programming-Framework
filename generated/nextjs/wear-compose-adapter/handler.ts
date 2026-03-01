// WearComposeAdapter — handler.ts
// Wear OS Compose adapter: normalizes widget props into Jetpack Compose for
// Wear OS component representations. Maps to Wear-specific composables
// (ScalingLazyColumn, Chip, TimeText, PositionIndicator, Vignette) and
// handles curved layout, rotary input, and ambient mode constraints.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WearComposeAdapterStorage,
  WearComposeAdapterNormalizeInput,
  WearComposeAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface WearComposeAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface WearComposeAdapterHandler {
  readonly normalize: (
    input: WearComposeAdapterNormalizeInput,
    storage: WearComposeAdapterStorage,
  ) => TE.TaskEither<WearComposeAdapterError, WearComposeAdapterNormalizeOutput>;
}

// --- Wear Compose component mapping ---

/** Wear OS Compose-specific composables */
const WEAR_COMPOSABLES: ReadonlySet<string> = new Set([
  'ScalingLazyColumn', 'Chip', 'CompactChip', 'TitleCard', 'AppCard',
  'TimeText', 'PositionIndicator', 'Vignette', 'Scaffold',
  'Button', 'ToggleButton', 'InlineSlider', 'Stepper',
  'CircularProgressIndicator', 'CurvedText', 'Dialog',
  'SwipeToDismissBox', 'PageIndicator', 'Picker',
]);

/** Standard Compose composables that also work on Wear */
const COMPOSE_COMPOSABLES: ReadonlySet<string> = new Set([
  'Box', 'Column', 'Row', 'Text', 'Image', 'Icon',
  'Spacer', 'LazyColumn', 'Card',
]);

/** Wear display constraints (round display) */
const WEAR_DISPLAY = { width: 227, height: 227, shape: 'round' as const };

/** Min touch target for Wear OS (slightly smaller than phone) */
const MIN_WEAR_TOUCH_TARGET = 48;

/** Map generic layout props to Compose modifier equivalents */
const PROP_TO_MODIFIER: Readonly<Record<string, string>> = {
  'padding': 'padding',
  'background-color': 'background',
  'backgroundColor': 'background',
  'width': 'width',
  'height': 'height',
  'border-radius': 'clip(RoundedCornerShape)',
  'borderRadius': 'clip(RoundedCornerShape)',
  'opacity': 'alpha',
  'weight': 'weight',
  'align': 'align',
};

const storageError = (error: unknown): WearComposeAdapterError => ({
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

/** Transform props to Wear Compose modifiers and parameters */
const transformToWearCompose = (
  props: Readonly<Record<string, unknown>>,
): {
  readonly modifiers: readonly { readonly name: string; readonly value: unknown }[];
  readonly params: Record<string, unknown>;
} => {
  const modifiers: { readonly name: string; readonly value: unknown }[] = [];
  const params: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const modifier = PROP_TO_MODIFIER[key];
    if (modifier !== undefined) {
      modifiers.push({ name: modifier, value });
    } else if (key === 'onClick' || key === 'onPress') {
      params['onClick'] = value;
    } else if (key === 'text' || key === 'label' || key === 'title') {
      params[key] = value;
    } else if (key === 'icon') {
      params['icon'] = value;
    } else if (key === 'secondaryLabel') {
      params['secondaryLabel'] = value;
    } else if (key === 'rotaryScrollable') {
      params['rotaryScrollable'] = value;
    } else if (key === 'ambientMode') {
      params['ambientMode'] = value;
    } else if (key === 'curvedLayout') {
      params['curvedLayout'] = value;
    } else if (key === 'color' || key === 'contentColor') {
      params['contentColor'] = value;
    } else if (key === 'enabled') {
      params['enabled'] = value;
    } else {
      params[key] = value;
    }
  }

  return { modifiers, params };
};

/** Resolve the Wear Compose composable from adapter string */
const resolveComposable = (adapter: string): string => {
  const parts = adapter.split('/');
  const raw = parts[parts.length - 1] ?? 'Chip';
  if (WEAR_COMPOSABLES.has(raw)) return raw;
  if (COMPOSE_COMPOSABLES.has(raw)) return raw;
  return 'Chip';
};

/** Check if the composable is interactive */
const isInteractive = (composable: string): boolean =>
  composable === 'Chip' || composable === 'CompactChip' ||
  composable === 'Button' || composable === 'ToggleButton' ||
  composable === 'InlineSlider' || composable === 'Stepper';

// --- Implementation ---

export const wearComposeAdapterHandler: WearComposeAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const composable = resolveComposable(input.adapter);
          const interactive = isInteractive(composable);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for Wear Compose adapter "${input.adapter}"`),
              (parsed) => {
                const { modifiers, params } = transformToWearCompose(parsed);

                // Enforce minimum touch target for interactive composables
                if (interactive) {
                  const hasMinSize = modifiers.some(
                    (m) => m.name === 'height' && typeof m.value === 'number' && m.value >= MIN_WEAR_TOUCH_TARGET,
                  );
                  if (!hasMinSize) {
                    modifiers.push({ name: 'defaultMinSize', value: { minWidth: MIN_WEAR_TOUCH_TARGET, minHeight: MIN_WEAR_TOUCH_TARGET } });
                  }
                }

                const normalized = JSON.stringify({
                  composable,
                  modifiers,
                  params,
                  platform: 'wear-compose',
                  runtime: 'android',
                  display: WEAR_DISPLAY,
                  interactive,
                  rotaryInput: params['rotaryScrollable'] === true,
                  ambientMode: params['ambientMode'] === true,
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
                  await storage.put('wearcomposeadapter', input.adapter, {
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
