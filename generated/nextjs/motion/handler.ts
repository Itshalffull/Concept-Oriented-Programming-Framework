// Motion — animation easing curves, duration scales, spring configs, and transition presets.
// Validates and registers named duration tokens, cubic-bezier or keyword easing functions,
// and composite transition presets that reference durations and easings.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MotionStorage,
  MotionDefineDurationInput,
  MotionDefineDurationOutput,
  MotionDefineEasingInput,
  MotionDefineEasingOutput,
  MotionDefineTransitionInput,
  MotionDefineTransitionOutput,
} from './types.js';

import {
  defineDurationOk,
  defineDurationInvalid,
  defineEasingOk,
  defineEasingInvalid,
  defineTransitionOk,
  defineTransitionInvalid,
} from './types.js';

export interface MotionError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): MotionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Minimum and maximum allowed duration in milliseconds. */
const MIN_DURATION_MS = 0;
const MAX_DURATION_MS = 10000;

/** Recognized CSS easing keywords. */
const EASING_KEYWORDS = [
  'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear',
  'step-start', 'step-end',
] as const;

/** Validate a cubic-bezier() expression or a keyword. */
const isValidEasing = (value: string): boolean => {
  const trimmed = value.trim();
  if ((EASING_KEYWORDS as readonly string[]).includes(trimmed)) {
    return true;
  }
  // Match cubic-bezier(n, n, n, n) where n is a float
  const cubicMatch = trimmed.match(
    /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/,
  );
  if (cubicMatch) {
    const [, x1, y1, x2, y2] = cubicMatch;
    const px1 = parseFloat(x1);
    const px2 = parseFloat(x2);
    // x1 and x2 must be in [0, 1] per CSS spec
    return px1 >= 0 && px1 <= 1 && px2 >= 0 && px2 <= 1
      && !Number.isNaN(parseFloat(y1)) && !Number.isNaN(parseFloat(y2));
  }
  // Match spring(stiffness, damping, mass) for physics-based animations
  const springMatch = trimmed.match(
    /^spring\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/,
  );
  if (springMatch) {
    const [, stiffness, damping, mass] = springMatch;
    return parseFloat(stiffness) > 0 && parseFloat(damping) > 0 && parseFloat(mass) > 0;
  }
  return false;
};

export interface MotionHandler {
  readonly defineDuration: (
    input: MotionDefineDurationInput,
    storage: MotionStorage,
  ) => TE.TaskEither<MotionError, MotionDefineDurationOutput>;
  readonly defineEasing: (
    input: MotionDefineEasingInput,
    storage: MotionStorage,
  ) => TE.TaskEither<MotionError, MotionDefineEasingOutput>;
  readonly defineTransition: (
    input: MotionDefineTransitionInput,
    storage: MotionStorage,
  ) => TE.TaskEither<MotionError, MotionDefineTransitionOutput>;
}

// --- Implementation ---

export const motionHandler: MotionHandler = {
  defineDuration: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (inp.ms < MIN_DURATION_MS || inp.ms > MAX_DURATION_MS) {
          return TE.right(
            defineDurationInvalid(
              `Duration must be between ${MIN_DURATION_MS}ms and ${MAX_DURATION_MS}ms, got ${inp.ms}ms`,
            ),
          );
        }
        if (inp.name.trim().length === 0) {
          return TE.right(defineDurationInvalid('Duration name must not be empty'));
        }

        return TE.tryCatch(
          async () => {
            await storage.put('duration', `${inp.motion}::${inp.name}`, {
              motion: inp.motion,
              name: inp.name,
              ms: inp.ms,
              seconds: Math.round(inp.ms / 10) / 100,
              cssValue: `${inp.ms}ms`,
            });
            return defineDurationOk(inp.motion);
          },
          storageErr,
        );
      }),
    ),

  defineEasing: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (inp.name.trim().length === 0) {
          return TE.right(defineEasingInvalid('Easing name must not be empty'));
        }
        if (!isValidEasing(inp.value)) {
          return TE.right(
            defineEasingInvalid(
              `Invalid easing value '${inp.value}'. Must be a CSS keyword (${EASING_KEYWORDS.join(', ')}), ` +
              `cubic-bezier(x1,y1,x2,y2), or spring(stiffness,damping,mass)`,
            ),
          );
        }

        return TE.tryCatch(
          async () => {
            await storage.put('easing', `${inp.motion}::${inp.name}`, {
              motion: inp.motion,
              name: inp.name,
              value: inp.value.trim(),
            });
            return defineEasingOk(inp.motion);
          },
          storageErr,
        );
      }),
    ),

  defineTransition: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const parsed: unknown = JSON.parse(input.config);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return defineTransitionInvalid('Transition config must be a JSON object');
          }
          const cfg = parsed as Record<string, unknown>;

          // Validate required fields
          if (typeof cfg.property !== 'string' || cfg.property.trim().length === 0) {
            return defineTransitionInvalid(
              'Transition config must include a "property" field (e.g. "opacity", "transform", "all")',
            );
          }

          // Build the CSS transition shorthand
          const property = String(cfg.property);
          const duration = cfg.duration !== undefined ? String(cfg.duration) : '200ms';
          const easing = cfg.easing !== undefined ? String(cfg.easing) : 'ease';
          const delay = cfg.delay !== undefined ? String(cfg.delay) : '0ms';
          const cssValue = `${property} ${duration} ${easing} ${delay}`;

          await storage.put('transition', `${input.motion}::${input.name}`, {
            motion: input.motion,
            name: input.name,
            config: cfg,
            cssValue,
          });
          return defineTransitionOk(input.motion);
        },
        (error) => {
          if (error instanceof SyntaxError) {
            return {
              code: 'PARSE_ERROR',
              message: `Invalid JSON in transition config: ${error.message}`,
            } as MotionError;
          }
          return storageErr(error);
        },
      ),
    ),
};
