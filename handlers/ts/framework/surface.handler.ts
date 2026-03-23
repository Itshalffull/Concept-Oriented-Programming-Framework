// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Surface Concept Implementation
//
// Deployment target. A Surface represents where the interface
// renders — browser DOM, terminal, native view, API endpoint.
// Handles initialization, capability detection, and lifecycle.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_KINDS = new Set(['browser-dom', 'terminal', 'react-native', 'webview', 'ssr', 'static-html']);

function detectCapabilities(kind: string): string[] {
  switch (kind) {
    case 'browser-dom': return ['dom', 'css', 'events', 'web-apis', 'animation'];
    case 'terminal': return ['ansi', 'stdin', 'resize'];
    case 'react-native': return ['native-views', 'gestures', 'animation'];
    case 'webview': return ['dom', 'css', 'bridge'];
    case 'ssr': return ['html-string', 'streaming'];
    case 'static-html': return ['html-string'];
    default: return [];
  }
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const surface = input.surface as string;
    const kind = input.kind as string;
    const mountPoint = input.mountPoint as string | undefined;

    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'unsupported', { message: `Unsupported surface kind: ${kind}` }) as StorageProgram<Result>;
    }

    const capabilities = detectCapabilities(kind);
    let p = createProgram();
    p = put(p, 'surfaces', surface, {
      id: surface,
      kind,
      capabilities: JSON.stringify(capabilities),
      status: 'created',
      mountPoint: mountPoint || null,
      config: null,
      renderer: null,
    });
    return complete(p, 'ok', { surface }) as StorageProgram<Result>;
  },

  attach(input: Record<string, unknown>) {
    const surface = input.surface as string;
    const renderer = input.renderer as string;

    let p = createProgram();
    p = get(p, 'surfaces', surface, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, '', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const kind = record.kind as string;
        // terminal-only-adapter is incompatible with non-terminal surfaces
        if (renderer.includes('terminal') && kind !== 'terminal') {
          return { variant: 'incompatible', message: `Renderer "${renderer}" is incompatible with surface kind "${kind}"` };
        }
        return { variant: 'ok', surface };
      }),
      (elseP) => complete(elseP, 'incompatible', { message: `Surface "${surface}" not found` }),
    ) as StorageProgram<Result>;
  },

  resize(input: Record<string, unknown>) {
    const surface = input.surface as string;

    let p = createProgram();
    p = get(p, 'surfaces', surface, 'record');

    return branch(p, 'record',
      (thenP) => complete(thenP, 'ok', { surface }),
      (elseP) => complete(elseP, 'notfound', { message: `Surface "${surface}" not found` }),
    ) as StorageProgram<Result>;
  },

  mount(input: Record<string, unknown>) {
    const surface = input.surface as string;

    let p = createProgram();
    p = get(p, 'surfaces', surface, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, '', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        if (!record.renderer && record.status !== 'created') {
          return { variant: 'error', message: 'No adapter attached' };
        }
        return { variant: 'ok', surface };
      }),
      (elseP) => complete(elseP, 'notfound', { message: `Surface "${surface}" not found` }),
    ) as StorageProgram<Result>;
  },

  unmount(input: Record<string, unknown>) {
    const surface = input.surface as string;
    const zone = input.zone as string | undefined;

    let p = createProgram();
    p = get(p, 'surfaces', surface, 'record');

    return branch(p, 'record',
      (thenP) => {
        if (zone && zone !== 'none') {
          return complete(thenP, 'notfound', { message: `Zone "${zone}" not found` });
        }
        return complete(thenP, 'ok', { surface });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Surface "${surface}" not found` }),
    ) as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const surface = input.surface as string;

    let p = createProgram();
    p = get(p, 'surfaces', surface, 'record');

    return branch(p, 'record',
      (thenP) => {
        let p2 = del(thenP, 'surfaces', surface);
        return complete(p2, 'ok', { surface });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Surface "${surface}" not found` }),
    ) as StorageProgram<Result>;
  },
};

export const surfaceHandler = autoInterpret(_handler);
