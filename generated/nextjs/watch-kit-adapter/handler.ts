// WatchKitAdapter — handler.ts
// Apple WatchKit adapter: normalizes widget props into WatchKit interface
// object representations. Maps to WKInterfaceController layout (WKInterfaceGroup,
// WKInterfaceLabel, WKInterfaceButton, WKInterfaceImage) and handles complications,
// crown input, haptic feedback, and watchOS-specific lifecycle annotations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WatchKitAdapterStorage,
  WatchKitAdapterNormalizeInput,
  WatchKitAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface WatchKitAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface WatchKitAdapterHandler {
  readonly normalize: (
    input: WatchKitAdapterNormalizeInput,
    storage: WatchKitAdapterStorage,
  ) => TE.TaskEither<WatchKitAdapterError, WatchKitAdapterNormalizeOutput>;
}

// --- WatchKit interface objects ---

/** WatchKit interface object types */
const WK_INTERFACE_OBJECTS: ReadonlySet<string> = new Set([
  'WKInterfaceGroup', 'WKInterfaceLabel', 'WKInterfaceButton',
  'WKInterfaceImage', 'WKInterfaceTable', 'WKInterfaceMap',
  'WKInterfaceSeparator', 'WKInterfaceSwitch', 'WKInterfaceSlider',
  'WKInterfaceTimer', 'WKInterfaceDate', 'WKInterfacePicker',
  'WKInterfaceMovie',
]);

/** Complication family types */
const COMPLICATION_FAMILIES: ReadonlySet<string> = new Set([
  'circularSmall', 'modularSmall', 'modularLarge',
  'utilitarianSmall', 'utilitarianSmallFlat', 'utilitarianLarge',
  'extraLarge', 'graphicCorner', 'graphicBezel', 'graphicCircular',
  'graphicRectangular', 'graphicExtraLarge',
]);

/** Haptic feedback types */
const HAPTIC_TYPES: ReadonlySet<string> = new Set([
  'notification', 'directionUp', 'directionDown',
  'success', 'failure', 'retry', 'start', 'stop',
  'click', 'navigationGenericManeuver', 'navigationLeftTurn',
  'navigationRightTurn',
]);

/** Map generic props to WatchKit property names */
const PROP_MAP: Readonly<Record<string, string>> = {
  'text': 'text',
  'color': 'textColor',
  'background-color': 'backgroundColor',
  'backgroundColor': 'backgroundColor',
  'font-size': 'fontSize',
  'fontSize': 'fontSize',
  'width': 'width',
  'height': 'height',
  'hidden': 'hidden',
  'alpha': 'alpha',
  'opacity': 'alpha',
  'image': 'imageName',
  'src': 'imageName',
  'enabled': 'enabled',
  'title': 'title',
};

/** Apple Watch display constraints */
const APPLE_WATCH_SIZES: Readonly<Record<string, { readonly width: number; readonly height: number }>> = {
  '38mm': { width: 136, height: 170 },
  '40mm': { width: 162, height: 197 },
  '41mm': { width: 176, height: 215 },
  '42mm': { width: 156, height: 195 },
  '44mm': { width: 184, height: 224 },
  '45mm': { width: 198, height: 242 },
  '49mm': { width: 205, height: 251 },
};

const storageError = (error: unknown): WatchKitAdapterError => ({
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

/** Transform props to WatchKit interface object properties */
const transformToWKProps = (
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  let hapticFeedback: string | undefined = undefined;

  for (const [key, value] of Object.entries(props)) {
    const wkProp = PROP_MAP[key];
    if (wkProp !== undefined) {
      result[wkProp] = value;
    } else if (key === 'haptic' && typeof value === 'string' && HAPTIC_TYPES.has(value)) {
      hapticFeedback = value;
    } else if (key === 'complicationFamily' && typeof value === 'string' && COMPLICATION_FAMILIES.has(value)) {
      result['complicationFamily'] = value;
    } else if (key === 'contentMode') {
      result['contentMode'] = value === 'fill' ? 'scaleAspectFill' : 'scaleAspectFit';
    } else if (key === 'alignment') {
      // WatchKit uses setHorizontalAlignment / setVerticalAlignment
      if (value === 'center') {
        result['horizontalAlignment'] = 'center';
        result['verticalAlignment'] = 'center';
      } else if (value === 'left' || value === 'leading') {
        result['horizontalAlignment'] = 'leading';
      } else if (value === 'right' || value === 'trailing') {
        result['horizontalAlignment'] = 'trailing';
      }
    } else if (key === 'layout') {
      // Group layout direction
      result['layoutDirection'] = value === 'horizontal' ? 'horizontal' : 'vertical';
    } else if (key !== 'watchSize' && key !== 'displaySize') {
      result[key] = value;
    }
  }

  if (hapticFeedback !== undefined) {
    result['hapticFeedback'] = hapticFeedback;
  }

  return result;
};

/** Resolve the target WatchKit interface object */
const resolveInterfaceObject = (adapter: string): string => {
  const parts = adapter.split('/');
  const raw = parts[parts.length - 1] ?? 'WKInterfaceGroup';
  if (WK_INTERFACE_OBJECTS.has(raw)) return raw;
  // Map generic names to WatchKit equivalents
  const lower = raw.toLowerCase();
  if (lower.includes('label') || lower.includes('text')) return 'WKInterfaceLabel';
  if (lower.includes('button')) return 'WKInterfaceButton';
  if (lower.includes('image')) return 'WKInterfaceImage';
  if (lower.includes('table') || lower.includes('list')) return 'WKInterfaceTable';
  return 'WKInterfaceGroup';
};

/** Resolve watch display size */
const resolveWatchSize = (props: Readonly<Record<string, unknown>>): { readonly width: number; readonly height: number } => {
  const size = typeof props['watchSize'] === 'string' ? props['watchSize'] : '45mm';
  return APPLE_WATCH_SIZES[size] ?? APPLE_WATCH_SIZES['45mm']!;
};

// --- Implementation ---

export const watchKitAdapterHandler: WatchKitAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const interfaceObject = resolveInterfaceObject(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for WatchKit adapter "${input.adapter}"`),
              (parsed) => {
                const wkProps = transformToWKProps(parsed);
                const display = resolveWatchSize(parsed);

                const normalized = JSON.stringify({
                  interfaceObject,
                  props: wkProps,
                  platform: 'watchkit',
                  runtime: 'watchos',
                  display,
                  supportsComplication: wkProps['complicationFamily'] !== undefined,
                  supportsHaptic: wkProps['hapticFeedback'] !== undefined,
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
                  await storage.put('watchkitadapter', input.adapter, {
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
