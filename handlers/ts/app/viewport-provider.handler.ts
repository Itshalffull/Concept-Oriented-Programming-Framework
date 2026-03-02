// ViewportProvider Concept Implementation [P]
// Provider lifecycle for viewport observation and responsive breakpoint computation.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const PLUGIN_REF = 'surface-provider:viewport';

const DEFAULT_BREAKPOINTS: Record<string, number> = {
  xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280,
};

function computeBreakpoint(width: number, breakpoints: Record<string, number>): string {
  const sorted = Object.entries(breakpoints).sort((a, b) => b[1] - a[1]);
  for (const [name, min] of sorted) {
    if (width >= min) return name;
  }
  return 'xs';
}

function computeOrientation(width: number, height: number): string {
  return width >= height ? 'landscape' : 'portrait';
}

export const viewportProviderHandler: ConceptHandler = {
  async initialize(input, storage) {
    const config = input.config as string;

    const existing = await storage.find('viewport-provider', { pluginRef: PLUGIN_REF });
    if (existing.length > 0) {
      return { variant: 'ok', provider: (existing[0] as Record<string, unknown>).id as string, pluginRef: PLUGIN_REF };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config || '{}');
    } catch {
      return { variant: 'configError', message: 'Invalid JSON in config' };
    }

    const id = nextId('vp');
    const customBreakpoints = parsed.breakpoints
      ? JSON.stringify(parsed.breakpoints)
      : JSON.stringify(DEFAULT_BREAKPOINTS);

    await storage.put('viewport-provider', id, {
      id,
      pluginRef: PLUGIN_REF,
      status: 'active',
      width: 0,
      height: 0,
      breakpoint: 'xs',
      orientation: 'landscape',
      breakpointConfig: customBreakpoints,
    });

    await storage.put('plugin-registry', PLUGIN_REF, {
      pluginKind: 'surface-provider',
      domain: 'viewport',
      providerRef: id,
      instanceId: id,
    });

    return { variant: 'ok', provider: id, pluginRef: PLUGIN_REF };
  },

  async observe(input, storage) {
    const provider = input.provider as string;
    const width = input.width as number;
    const height = input.height as number;

    const instance = await storage.get('viewport-provider', provider);
    if (!instance) {
      return { variant: 'ok', provider, breakpoint: 'xs', orientation: 'landscape' };
    }

    const breakpoints = JSON.parse((instance.breakpointConfig as string) || '{}');
    const breakpoint = computeBreakpoint(width, breakpoints);
    const orientation = computeOrientation(width, height);

    await storage.put('viewport-provider', provider, {
      ...instance,
      width,
      height,
      breakpoint,
      orientation,
    });

    return { variant: 'ok', provider, breakpoint, orientation };
  },

  async getBreakpoint(input, storage) {
    const provider = input.provider as string;

    const instance = await storage.get('viewport-provider', provider);
    if (!instance || !(instance.width as number)) {
      return { variant: 'notInitialized', message: 'No observation recorded' };
    }

    return {
      variant: 'ok',
      provider,
      breakpoint: instance.breakpoint as string,
      width: instance.width as number,
      height: instance.height as number,
    };
  },

  async setBreakpoints(input, storage) {
    const provider = input.provider as string;
    const breakpoints = input.breakpoints as string;

    let parsed: Record<string, number>;
    try {
      parsed = JSON.parse(breakpoints);
    } catch {
      return { variant: 'invalid', message: 'Breakpoints must be valid JSON' };
    }

    const values = Object.values(parsed);
    for (let i = 1; i < values.length; i++) {
      if (values[i] <= values[i - 1]) {
        return { variant: 'invalid', message: 'Breakpoint values must be ascending positive integers' };
      }
    }

    const instance = await storage.get('viewport-provider', provider);
    if (!instance) {
      return { variant: 'invalid', message: 'Provider not found' };
    }

    const width = instance.width as number;
    const height = instance.height as number;
    const breakpoint = computeBreakpoint(width, parsed);

    await storage.put('viewport-provider', provider, {
      ...instance,
      breakpointConfig: breakpoints,
      breakpoint,
    });

    return { variant: 'ok', provider };
  },
};
