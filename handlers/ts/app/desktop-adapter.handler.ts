// @migrated dsl-constructs 2026-03-18
// ============================================================
// DesktopAdapter Handler
//
// Transforms framework-neutral props into desktop application
// bindings: Electron/Tauri IPC channels, native window events.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const DESKTOP_IPC_MAP: Record<string, string> = {
  onclick: 'click',
  ondoubleclick: 'double-click',
  onchange: 'change',
  onsubmit: 'submit',
  onfocus: 'focus',
  onblur: 'blur',
  onkeydown: 'key-down',
  onkeyup: 'key-up',
  onclose: 'close',
  onminimize: 'minimize',
  onmaximize: 'maximize',
  onresize: 'resize',
  onmove: 'move',
  ondrag: 'drag',
  ondrop: 'drop',
};

const desktopAdapterHandlerFunctional: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }
      if (key === 'class') {
        normalized['className'] = value;
        continue;
      }
      if (key.startsWith('on')) {
        const channel = DESKTOP_IPC_MAP[key.toLowerCase()];
        if (channel) {
          normalized[`ipc:${channel}`] = { ipc: { channel, handler: value } };
        } else {
          const eventName = key.slice(2).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          normalized[`ipc:${eventName}`] = { ipc: { channel: eventName, handler: value } };
        }
        continue;
      }
      if (key === 'style') {
        normalized['style'] = value;
        continue;
      }
      normalized[key] = value;
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const desktopAdapterHandler = wrapFunctional(desktopAdapterHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { desktopAdapterHandlerFunctional };
