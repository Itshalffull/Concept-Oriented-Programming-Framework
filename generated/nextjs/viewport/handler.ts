// Viewport — responsive breakpoint management, media query generation, and orientation tracking.
// Observes viewport dimensions, classifies breakpoints, and detects portrait/landscape orientation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ViewportStorage,
  ViewportObserveInput,
  ViewportObserveOutput,
  ViewportSetBreakpointsInput,
  ViewportSetBreakpointsOutput,
  ViewportGetBreakpointInput,
  ViewportGetBreakpointOutput,
} from './types.js';

import {
  observeOk,
  setBreakpointsOk,
  setBreakpointsInvalid,
  getBreakpointOk,
  getBreakpointNotfound,
} from './types.js';

export interface ViewportError {
  readonly code: string;
  readonly message: string;
}

const storageErr = (error: unknown): ViewportError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Default responsive breakpoints (min-width in px)
const DEFAULT_BREAKPOINTS: Record<string, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/** Classify a width against a sorted breakpoint map, returning the largest matching label. */
const classifyBreakpoint = (
  width: number,
  breakpoints: Record<string, number>,
): string => {
  const sorted = Object.entries(breakpoints).sort(([, a], [, b]) => b - a);
  for (const [label, minWidth] of sorted) {
    if (width >= minWidth) {
      return label;
    }
  }
  return sorted.length > 0 ? sorted[sorted.length - 1][0] : 'unknown';
};

/** Determine orientation from width and height. */
const detectOrientation = (width: number, height: number): string =>
  width > height ? 'landscape' : width < height ? 'portrait' : 'square';

export interface ViewportHandler {
  readonly observe: (
    input: ViewportObserveInput,
    storage: ViewportStorage,
  ) => TE.TaskEither<ViewportError, ViewportObserveOutput>;
  readonly setBreakpoints: (
    input: ViewportSetBreakpointsInput,
    storage: ViewportStorage,
  ) => TE.TaskEither<ViewportError, ViewportSetBreakpointsOutput>;
  readonly getBreakpoint: (
    input: ViewportGetBreakpointInput,
    storage: ViewportStorage,
  ) => TE.TaskEither<ViewportError, ViewportGetBreakpointOutput>;
}

// --- Implementation ---

export const viewportHandler: ViewportHandler = {
  observe: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Load custom breakpoints or fall back to defaults
          const bpRecord = await storage.get('breakpoints', input.viewport);
          const breakpoints: Record<string, number> =
            bpRecord !== null
              ? (bpRecord as any).breakpoints ?? DEFAULT_BREAKPOINTS
              : DEFAULT_BREAKPOINTS;

          const breakpoint = classifyBreakpoint(input.width, breakpoints);
          const orientation = detectOrientation(input.width, input.height);

          // Persist the observed state
          await storage.put('viewport', input.viewport, {
            viewport: input.viewport,
            width: input.width,
            height: input.height,
            breakpoint,
            orientation,
          });

          return observeOk(input.viewport, breakpoint, orientation);
        },
        storageErr,
      ),
    ),

  setBreakpoints: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Parse the JSON breakpoint map
          const parsed: unknown = JSON.parse(input.breakpoints);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return setBreakpointsInvalid(
              'Breakpoints must be a JSON object mapping label names to numeric min-width values',
            );
          }
          const bpMap = parsed as Record<string, unknown>;
          // Validate every value is a non-negative number
          for (const [label, value] of Object.entries(bpMap)) {
            if (typeof value !== 'number' || value < 0) {
              return setBreakpointsInvalid(
                `Breakpoint '${label}' must be a non-negative number, got ${String(value)}`,
              );
            }
          }

          await storage.put('breakpoints', input.viewport, {
            viewport: input.viewport,
            breakpoints: bpMap,
          });

          return setBreakpointsOk(input.viewport);
        },
        (error) => {
          // JSON.parse can throw SyntaxError
          if (error instanceof SyntaxError) {
            return {
              code: 'PARSE_ERROR',
              message: `Invalid JSON in breakpoints: ${error.message}`,
            } as ViewportError;
          }
          return storageErr(error);
        },
      ),
    ),

  getBreakpoint: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('viewport', input.viewport),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(getBreakpointNotfound(`Viewport '${input.viewport}' has not been observed yet`)),
            (found) =>
              TE.right(
                getBreakpointOk(
                  input.viewport,
                  String((found as any).breakpoint ?? 'unknown'),
                  Number((found as any).width ?? 0),
                  Number((found as any).height ?? 0),
                ),
              ),
          ),
        ),
      ),
    ),
};
