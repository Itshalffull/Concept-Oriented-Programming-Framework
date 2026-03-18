// @migrated dsl-constructs 2026-03-18
// WatchAdapter Handler — Transforms framework-neutral props into watchOS bindings.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const WATCH_EVENT_MAP: Record<string, string> = { onclick: 'onTapGesture', onlongpress: 'onLongPressGesture', onchange: 'onChange', onappear: 'onAppear', ondisappear: 'onDisappear', onscroll: 'digitalCrownRotation' };
const UNSUPPORTED_WATCH_EVENTS = new Set(['ondoubleclick','ondrag','ondrop','onhover','onmouseenter','onmouseleave','onkeydown','onkeyup','onresize','oncontextmenu']);

const watchAdapterHandlerFunctional: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string; const props = input.props as string;
    if (!props || props.trim() === '') { let p = createProgram(); return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-')) { normalized[key.replace('aria-', 'accessibility')] = value; continue; }
      if (key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['__styleClass'] = value; continue; }
      if (key.startsWith('on')) { if (UNSUPPORTED_WATCH_EVENTS.has(key.toLowerCase())) { normalized[`__unsupported:${key}`] = value; continue; } const we = WATCH_EVENT_MAP[key.toLowerCase()]; if (we) { normalized[we] = value; } else { const en = key.slice(2).toLowerCase(); normalized[`on${en.charAt(0).toUpperCase()}${en.slice(1)}`] = value; } continue; }
      if (key === 'style') { normalized['__modifiers'] = value; continue; }
      normalized[key] = value;
    }
    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const watchAdapterHandler = wrapFunctional(watchAdapterHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { watchAdapterHandlerFunctional };
