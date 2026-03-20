// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Viewport Concept Implementation [V]
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }
const DEFAULT_BREAKPOINTS: Record<string, { min: number; max: number }> = { xs: { min: 0, max: 479 }, sm: { min: 480, max: 767 }, md: { min: 768, max: 1023 }, lg: { min: 1024, max: 1279 }, xl: { min: 1280, max: Infinity } };
function detectBreakpoint(width: number, breakpoints: Record<string, { min: number; max: number }>): string { for (const [name, range] of Object.entries(breakpoints)) { if (width >= range.min && width <= range.max) return name; } return 'unknown'; }
function detectOrientation(width: number, height: number): string { if (width > height) return 'landscape'; if (height > width) return 'portrait'; return 'square'; }

const _viewportHandler: FunctionalConceptHandler = {
  observe(input: Record<string, unknown>) {
    const viewport = input.viewport as string; const width = input.width as number; const height = input.height as number;
    const id = viewport || nextId('V');
    const breakpoint = detectBreakpoint(width, DEFAULT_BREAKPOINTS); const orientation = detectOrientation(width, height);
    let p = createProgram();
    p = put(p, 'viewport', id, { width, height, breakpoint, orientation, customBreakpoints: JSON.stringify(DEFAULT_BREAKPOINTS) });
    return complete(p, 'ok', { breakpoint, orientation }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setBreakpoints(input: Record<string, unknown>) {
    const viewport = input.viewport as string; const breakpoints = input.breakpoints as string;
    let parsed: Record<string, { min: number; max: number }>;
    try { parsed = JSON.parse(breakpoints); } catch { let p = createProgram(); return complete(p, 'invalid', { message: 'Breakpoints must be valid JSON with { name: { min, max } } entries' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    for (const [name, range] of Object.entries(parsed)) {
      if (typeof range.min !== 'number' || typeof range.max !== 'number') { let p = createProgram(); return complete(p, 'invalid', { message: `Breakpoint "${name}" must have numeric min and max values` }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
      if (range.min < 0) { let p = createProgram(); return complete(p, 'invalid', { message: `Breakpoint "${name}" min value cannot be negative` }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    }
    const id = viewport || nextId('V');
    let p = createProgram();
    p = put(p, 'viewport', id, { width: 0, height: 0, breakpoint: 'unknown', orientation: 'unknown', customBreakpoints: JSON.stringify(parsed) });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getBreakpoint(input: Record<string, unknown>) {
    const viewport = input.viewport as string;
    let p = createProgram();
    p = spGet(p, 'viewport', viewport, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { breakpoint: '', width: 0, height: 0 }),
      (b) => complete(b, 'notfound', { message: `Viewport "${viewport}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const viewportHandler = autoInterpret(_viewportHandler);

