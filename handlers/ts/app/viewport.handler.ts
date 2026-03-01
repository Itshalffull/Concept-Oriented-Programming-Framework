// Viewport Concept Implementation [V]
// Responsive viewport observation with breakpoint detection and custom breakpoint support.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const DEFAULT_BREAKPOINTS: Record<string, { min: number; max: number }> = {
  xs: { min: 0, max: 479 },
  sm: { min: 480, max: 767 },
  md: { min: 768, max: 1023 },
  lg: { min: 1024, max: 1279 },
  xl: { min: 1280, max: Infinity },
};

function detectBreakpoint(width: number, breakpoints: Record<string, { min: number; max: number }>): string {
  for (const [name, range] of Object.entries(breakpoints)) {
    if (width >= range.min && width <= range.max) {
      return name;
    }
  }
  return 'unknown';
}

function detectOrientation(width: number, height: number): string {
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}

export const viewportHandler: ConceptHandler = {
  async observe(input, storage) {
    const viewport = input.viewport as string;
    const width = input.width as number;
    const height = input.height as number;

    const id = viewport || nextId('V');

    // Load custom breakpoints if defined, otherwise use defaults
    const existing = await storage.get('viewport', id);
    let breakpoints = DEFAULT_BREAKPOINTS;
    if (existing && existing.customBreakpoints) {
      try {
        breakpoints = JSON.parse(existing.customBreakpoints as string);
      } catch {
        // Fall back to defaults
      }
    }

    const breakpoint = detectBreakpoint(width, breakpoints);
    const orientation = detectOrientation(width, height);

    await storage.put('viewport', id, {
      width,
      height,
      breakpoint,
      orientation,
      customBreakpoints: existing?.customBreakpoints || JSON.stringify(DEFAULT_BREAKPOINTS),
    });

    return {
      variant: 'ok',
      breakpoint,
      orientation,
    };
  },

  async setBreakpoints(input, storage) {
    const viewport = input.viewport as string;
    const breakpoints = input.breakpoints as string;

    let parsed: Record<string, { min: number; max: number }>;
    try {
      parsed = JSON.parse(breakpoints);
    } catch {
      return { variant: 'invalid', message: 'Breakpoints must be valid JSON with { name: { min, max } } entries' };
    }

    // Validate breakpoint structure
    for (const [name, range] of Object.entries(parsed)) {
      if (typeof range.min !== 'number' || typeof range.max !== 'number') {
        return { variant: 'invalid', message: `Breakpoint "${name}" must have numeric min and max values` };
      }
      if (range.min < 0) {
        return { variant: 'invalid', message: `Breakpoint "${name}" min value cannot be negative` };
      }
      if (range.min > range.max && range.max !== Infinity) {
        return { variant: 'invalid', message: `Breakpoint "${name}" min (${range.min}) exceeds max (${range.max})` };
      }
    }

    const id = viewport || nextId('V');

    const existing = await storage.get('viewport', id);
    if (existing) {
      // Re-detect breakpoint with new ranges if dimensions are known
      const width = existing.width as number;
      const height = existing.height as number;
      const breakpoint = detectBreakpoint(width, parsed);
      const orientation = detectOrientation(width, height);

      await storage.put('viewport', id, {
        ...existing,
        customBreakpoints: JSON.stringify(parsed),
        breakpoint,
        orientation,
      });
    } else {
      await storage.put('viewport', id, {
        width: 0,
        height: 0,
        breakpoint: 'unknown',
        orientation: 'unknown',
        customBreakpoints: JSON.stringify(parsed),
      });
    }

    return { variant: 'ok' };
  },

  async getBreakpoint(input, storage) {
    const viewport = input.viewport as string;

    const existing = await storage.get('viewport', viewport);
    if (!existing) {
      return { variant: 'notfound', message: `Viewport "${viewport}" not found` };
    }

    return {
      variant: 'ok',
      breakpoint: existing.breakpoint as string,
      width: existing.width as number,
      height: existing.height as number,
    };
  },
};
