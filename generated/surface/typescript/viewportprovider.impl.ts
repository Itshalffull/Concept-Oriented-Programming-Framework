// ViewportProvider Concept Implementation
// Manages viewport observation, breakpoint resolution, and responsive layout configuration.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'viewportprovider';
const META_KEY = '__meta__';
const BREAKPOINT_PREFIX = 'bp:';
const OBSERVATION_PREFIX = 'obs:';

const DEFAULT_BREAKPOINTS = [
  { name: 'xs', minWidth: 0, maxWidth: 575 },
  { name: 'sm', minWidth: 576, maxWidth: 767 },
  { name: 'md', minWidth: 768, maxWidth: 991 },
  { name: 'lg', minWidth: 992, maxWidth: 1199 },
  { name: 'xl', minWidth: 1200, maxWidth: null },
];

export const viewportproviderHandler: ConceptHandler = {
  /**
   * initialize(config) -> ok(provider, pluginRef) | configError(message)
   * Idempotent initialization of the viewport provider with default breakpoints.
   */
  async initialize(input, storage) {
    const config = input.config as Record<string, unknown>;

    if (!config || typeof config !== 'object') {
      return { variant: 'configError', message: 'Config must be a non-null object' };
    }

    const existing = await storage.get(RELATION, META_KEY);
    if (existing) {
      return {
        variant: 'ok',
        provider: existing.provider as string,
        pluginRef: existing.pluginRef as string,
      };
    }

    const provider = `viewportprovider-${Date.now()}`;
    const pluginRef = 'surface-provider:viewport';

    await storage.put(RELATION, META_KEY, {
      provider,
      pluginRef,
      config: JSON.stringify(config),
    });

    // Seed default breakpoints
    for (const bp of DEFAULT_BREAKPOINTS) {
      await storage.put(RELATION, `${BREAKPOINT_PREFIX}${bp.name}`, {
        name: bp.name,
        minWidth: bp.minWidth,
        maxWidth: bp.maxWidth,
      });
    }

    return { variant: 'ok', provider, pluginRef };
  },

  /**
   * observe(target) -> ok(target, width, height, breakpoint) | notfound(message)
   * Retrieves the current observed dimensions for a target element or viewport.
   */
  async observe(input, storage) {
    const target = input.target as string;

    const observation = await storage.get(RELATION, `${OBSERVATION_PREFIX}${target}`);
    if (!observation) {
      return { variant: 'notfound', message: `No observation registered for target "${target}"` };
    }

    const width = observation.width as number;
    const height = observation.height as number;

    // Determine the breakpoint for the current width
    const breakpoints = await storage.find(RELATION);
    const bps = breakpoints
      .filter((e) => (e._key as string).startsWith(BREAKPOINT_PREFIX))
      .sort((a, b) => (a.minWidth as number) - (b.minWidth as number));

    let breakpoint = 'unknown';
    for (const bp of bps) {
      const min = bp.minWidth as number;
      const max = bp.maxWidth as number | null;
      if (width >= min && (max === null || width <= max)) {
        breakpoint = bp.name as string;
        break;
      }
    }

    return { variant: 'ok', target, width, height, breakpoint };
  },

  /**
   * getBreakpoint(width) -> ok(breakpoint, minWidth, maxWidth)
   * Returns the matching breakpoint for a given pixel width.
   */
  async getBreakpoint(input, storage) {
    const width = input.width as number;

    const allEntries = await storage.find(RELATION);
    const bps = allEntries
      .filter((e) => (e._key as string).startsWith(BREAKPOINT_PREFIX))
      .sort((a, b) => (a.minWidth as number) - (b.minWidth as number));

    for (const bp of bps) {
      const min = bp.minWidth as number;
      const max = bp.maxWidth as number | null;
      if (width >= min && (max === null || width <= max)) {
        return {
          variant: 'ok',
          breakpoint: bp.name as string,
          minWidth: min,
          maxWidth: max,
        };
      }
    }

    // Fallback: if no breakpoints match, return the last one
    if (bps.length > 0) {
      const last = bps[bps.length - 1];
      return {
        variant: 'ok',
        breakpoint: last.name as string,
        minWidth: last.minWidth as number,
        maxWidth: last.maxWidth as number | null,
      };
    }

    return { variant: 'ok', breakpoint: 'unknown', minWidth: 0, maxWidth: null };
  },

  /**
   * setBreakpoints(breakpoints) -> ok(count) | invalid(message)
   * Replaces the current breakpoint configuration.
   */
  async setBreakpoints(input, storage) {
    const breakpoints = input.breakpoints as Array<{
      name: string;
      minWidth: number;
      maxWidth: number | null;
    }>;

    if (!Array.isArray(breakpoints) || breakpoints.length === 0) {
      return { variant: 'invalid', message: 'Breakpoints must be a non-empty array' };
    }

    // Validate no overlapping ranges
    const sorted = [...breakpoints].sort((a, b) => a.minWidth - b.minWidth);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.maxWidth !== null && curr.minWidth <= prev.maxWidth) {
        return {
          variant: 'invalid',
          message: `Breakpoints "${prev.name}" and "${curr.name}" have overlapping ranges`,
        };
      }
    }

    // Remove existing breakpoints
    const existing = await storage.find(RELATION);
    for (const entry of existing) {
      const key = entry._key as string;
      if (key.startsWith(BREAKPOINT_PREFIX)) {
        await storage.del(RELATION, key);
      }
    }

    // Store new breakpoints
    for (const bp of sorted) {
      await storage.put(RELATION, `${BREAKPOINT_PREFIX}${bp.name}`, {
        name: bp.name,
        minWidth: bp.minWidth,
        maxWidth: bp.maxWidth,
      });
    }

    return { variant: 'ok', count: sorted.length };
  },
};
