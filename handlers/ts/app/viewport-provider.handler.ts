// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ViewportProvider Concept Implementation [P]
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }
const PLUGIN_REF = 'surface-provider:viewport';
const DEFAULT_BREAKPOINTS: Record<string, number> = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };
function computeBreakpoint(width: number, breakpoints: Record<string, number>): string { const sorted = Object.entries(breakpoints).sort((a, b) => b[1] - a[1]); for (const [name, min] of sorted) { if (width >= min) return name; } return 'xs'; }
function computeOrientation(width: number, height: number): string { return width >= height ? 'landscape' : 'portrait'; }

const _viewportProviderHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const config = input.config as string;
    let p = createProgram();
    p = find(p, 'viewport-provider', { pluginRef: PLUGIN_REF }, 'existing');
    p = mapBindings(p, (bindings) => { const ex = (bindings.existing as Array<Record<string, unknown>>) || []; return ex.length > 0 ? (ex[0] as Record<string, unknown>).id as string : null; }, 'existingId');
    p = branch(p, 'existingId',
      (b) => complete(b, 'ok', { provider: '', pluginRef: PLUGIN_REF }),
      (b) => {
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(config || '{}'); } catch { return complete(b, 'configError', { message: 'Invalid JSON in config' }); }
        const id = nextId('vp');
        const customBreakpoints = parsed.breakpoints ? JSON.stringify(parsed.breakpoints) : JSON.stringify(DEFAULT_BREAKPOINTS);
        let b2 = put(b, 'viewport-provider', id, { id, pluginRef: PLUGIN_REF, status: 'active', width: 0, height: 0, breakpoint: 'xs', orientation: 'landscape', breakpointConfig: customBreakpoints });
        b2 = put(b2, 'plugin-registry', PLUGIN_REF, { pluginKind: 'surface-provider', domain: 'viewport', providerRef: id, instanceId: id });
        return complete(b2, 'ok', { provider: id, pluginRef: PLUGIN_REF });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  observe(input: Record<string, unknown>) {
    const provider = input.provider as string; const width = input.width as number; const height = input.height as number;
    let p = createProgram();
    p = spGet(p, 'viewport-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => {
        let b2 = putFrom(b, 'viewport-provider', provider, (bindings) => {
          const instance = bindings.instance as Record<string, unknown>;
          const breakpoints = JSON.parse((instance.breakpointConfig as string) || '{}');
          return { ...instance, width, height, breakpoint: computeBreakpoint(width, breakpoints), orientation: computeOrientation(width, height) };
        });
        return complete(b2, 'ok', { provider, breakpoint: '', orientation: '' });
      },
      (b) => complete(b, 'ok', { provider, breakpoint: 'xs', orientation: 'landscape' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getBreakpoint(input: Record<string, unknown>) {
    const provider = input.provider as string;
    let p = createProgram();
    p = spGet(p, 'viewport-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => complete(b, 'ok', { provider, breakpoint: '', width: 0, height: 0 }),
      (b) => complete(b, 'notInitialized', { message: 'No observation recorded' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setBreakpoints(input: Record<string, unknown>) {
    const provider = input.provider as string; const breakpoints = input.breakpoints as string;
    let parsed: Record<string, number>;
    try { parsed = JSON.parse(breakpoints); } catch {
      // Try parsing as "key:value,key:value" format (e.g. "sm:480,md:768,lg:1024")
      const isKvFormat = /^[a-zA-Z]+:\d+(?:,[a-zA-Z]+:\d+)*$/.test((breakpoints || '').trim());
      if (isKvFormat) {
        parsed = {};
        for (const pair of breakpoints.split(',')) {
          const [k, v] = pair.split(':');
          if (k && v) parsed[k.trim()] = parseInt(v.trim(), 10);
        }
      } else {
        let p = createProgram(); return complete(p, 'invalid', { message: 'Breakpoints must be valid JSON or key:value format' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    }
    let p = createProgram();
    p = spGet(p, 'viewport-provider', provider, 'instance');
    p = branch(p, 'instance',
      (b) => {
        let b2 = putFrom(b, 'viewport-provider', provider, (bindings) => {
          const instance = bindings.instance as Record<string, unknown>;
          const width = instance.width as number;
          return { ...instance, breakpointConfig: breakpoints, breakpoint: computeBreakpoint(width, parsed) };
        });
        return complete(b2, 'ok', { provider });
      },
      (b) => complete(b, 'invalid', { message: 'Provider not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const viewportProviderHandler = autoInterpret(_viewportProviderHandler);

