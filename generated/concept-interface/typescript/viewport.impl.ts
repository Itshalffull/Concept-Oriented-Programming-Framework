// ============================================================
// Viewport Concept Implementation
//
// Responsive breakpoint tracker. Observes viewport dimensions,
// calculates named breakpoints from width thresholds, determines
// orientation, and supports custom breakpoint definitions.
// Relation: 'viewport' keyed by viewport (V).
//
// Default breakpoints:
//   xs: 0-479, sm: 480-767, md: 768-1023, lg: 1024-1279, xl: 1280+
// Orientation:
//   width >= height -> "landscape", otherwise "portrait"
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'viewport';

/** Default breakpoint thresholds (min-width for each named breakpoint). */
const DEFAULT_BREAKPOINTS: [string, number][] = [
  ['xs', 0],
  ['sm', 480],
  ['md', 768],
  ['lg', 1024],
  ['xl', 1280],
];

/**
 * Calculate the breakpoint name for a given width using sorted
 * ascending breakpoint thresholds. The highest threshold that the
 * width meets or exceeds determines the breakpoint.
 */
function calculateBreakpoint(
  width: number,
  breakpoints: [string, number][],
): string {
  // Breakpoints should be sorted ascending by threshold
  const sorted = [...breakpoints].sort((a, b) => a[1] - b[1]);
  let result = sorted[0][0]; // default to smallest

  for (const [name, minWidth] of sorted) {
    if (width >= minWidth) {
      result = name;
    } else {
      break;
    }
  }

  return result;
}

/** Determine orientation from dimensions. */
function calculateOrientation(width: number, height: number): string {
  return width >= height ? 'landscape' : 'portrait';
}

export const viewportHandler: ConceptHandler = {
  /**
   * observe(viewport, width, height)
   *   -> ok(viewport, breakpoint, orientation)
   *
   * Records the current viewport dimensions, calculates the active
   * breakpoint from width thresholds, and determines orientation.
   */
  async observe(input, storage) {
    const viewport = input.viewport as string;
    const width = input.width as number;
    const height = input.height as number;

    // Load existing record to check for custom breakpoints
    const existing = await storage.get(RELATION, viewport);
    let breakpoints = DEFAULT_BREAKPOINTS;

    if (existing && existing.customBreakpoints) {
      try {
        const custom = JSON.parse(existing.customBreakpoints as string) as Record<string, number>;
        const entries = Object.entries(custom) as [string, number][];
        if (entries.length > 0) {
          breakpoints = entries;
        }
      } catch {
        // Fall back to defaults
      }
    }

    const breakpoint = calculateBreakpoint(width, breakpoints);
    const orientation = calculateOrientation(width, height);

    await storage.put(RELATION, viewport, {
      viewport,
      width,
      height,
      breakpoint,
      orientation,
      customBreakpoints: existing?.customBreakpoints ?? null,
    });

    return { variant: 'ok', viewport, breakpoint, orientation };
  },

  /**
   * setBreakpoints(viewport, breakpoints)
   *   -> ok(viewport) | invalid(message)
   *
   * Sets custom breakpoint thresholds for a viewport. The breakpoints
   * parameter is a JSON string mapping breakpoint names to minimum
   * width integers. Validates that all values are ascending positive
   * integers.
   */
  async setBreakpoints(input, storage) {
    const viewport = input.viewport as string;
    const breakpoints = input.breakpoints as string;

    let parsed: Record<string, number>;
    try {
      parsed = JSON.parse(breakpoints) as Record<string, number>;
    } catch {
      return {
        variant: 'invalid',
        message: 'Breakpoints must be a valid JSON object mapping names to integers',
      };
    }

    const entries = Object.entries(parsed);
    if (entries.length === 0) {
      return {
        variant: 'invalid',
        message: 'Breakpoints object must contain at least one entry',
      };
    }

    // Validate: all values must be non-negative integers
    for (const [name, value] of entries) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        return {
          variant: 'invalid',
          message: `Breakpoint "${name}" must be a non-negative integer, got ${String(value)}`,
        };
      }
    }

    // Validate: values when sorted must be strictly ascending
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i][1] <= sorted[i - 1][1]) {
        return {
          variant: 'invalid',
          message: `Breakpoint thresholds must be strictly ascending; "${sorted[i][0]}" (${sorted[i][1]}) is not greater than "${sorted[i - 1][0]}" (${sorted[i - 1][1]})`,
        };
      }
    }

    // Load or create viewport record
    const existing = await storage.get(RELATION, viewport);

    if (existing) {
      // Re-calculate breakpoint if dimensions are already stored
      const width = existing.width as number;
      const height = existing.height as number;
      const bpEntries = sorted as [string, number][];
      const breakpoint = calculateBreakpoint(width, bpEntries);
      const orientation = calculateOrientation(width, height);

      await storage.put(RELATION, viewport, {
        ...existing,
        customBreakpoints: breakpoints,
        breakpoint,
        orientation,
      });
    } else {
      await storage.put(RELATION, viewport, {
        viewport,
        width: 0,
        height: 0,
        breakpoint: sorted[0][0],
        orientation: 'landscape',
        customBreakpoints: breakpoints,
      });
    }

    return { variant: 'ok', viewport };
  },

  /**
   * getBreakpoint(viewport)
   *   -> ok(viewport, breakpoint, width, height) | notfound(message)
   *
   * Returns the current breakpoint, width, and height for a viewport.
   */
  async getBreakpoint(input, storage) {
    const viewport = input.viewport as string;

    const record = await storage.get(RELATION, viewport);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Viewport "${viewport}" not found`,
      };
    }

    return {
      variant: 'ok',
      viewport,
      breakpoint: record.breakpoint as string,
      width: record.width as number,
      height: record.height as number,
    };
  },
};
