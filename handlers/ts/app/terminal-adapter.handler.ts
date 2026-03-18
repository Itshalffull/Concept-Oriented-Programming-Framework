// @migrated dsl-constructs 2026-03-18
// ============================================================
// TerminalAdapter Handler
//
// Transforms framework-neutral props into terminal bindings:
// ANSI escape codes, keyboard event handlers, readline input.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const TERMINAL_KEY_MAP: Record<string, string> = {
  onclick: 'enter', onsubmit: 'enter', onkeydown: 'keypress', onkeyup: 'keypress',
  onfocus: 'focus', onblur: 'blur', onchange: 'input', onescape: 'escape', ontab: 'tab',
};
const ANSI_CLASS_MAP: Record<string, string> = {
  bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m', underline: '\x1b[4m',
  blink: '\x1b[5m', inverse: '\x1b[7m', hidden: '\x1b[8m', strikethrough: '\x1b[9m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
  'bg-red': '\x1b[41m', 'bg-green': '\x1b[42m', 'bg-yellow': '\x1b[43m', 'bg-blue': '\x1b[44m',
};
const ANSI_RESET = '\x1b[0m';

const terminalAdapterHandlerFunctional: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;
    if (!props || props.trim() === '') { let p = createProgram(); return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-') || key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') {
        const classes = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];
        const ansiCodes: string[] = [];
        for (const cls of classes) { const code = ANSI_CLASS_MAP[cls.toLowerCase()]; if (code) ansiCodes.push(code); }
        normalized['__ansi'] = { prefix: ansiCodes.join(''), suffix: ansiCodes.length > 0 ? ANSI_RESET : '', classes };
        continue;
      }
      if (key.startsWith('on')) {
        const terminalKey = TERMINAL_KEY_MAP[key.toLowerCase()];
        if (terminalKey) { normalized[`keybinding:${terminalKey}`] = { key: terminalKey, handler: value }; }
        else { const eventName = key.slice(2).toLowerCase(); normalized[`keybinding:${eventName}`] = { key: eventName, handler: value }; }
        continue;
      }
      if (key === 'style') { normalized['__ansiStyle'] = value; continue; }
      normalized[key] = value;
    }
    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const terminalAdapterHandler = wrapFunctional(terminalAdapterHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { terminalAdapterHandlerFunctional };
