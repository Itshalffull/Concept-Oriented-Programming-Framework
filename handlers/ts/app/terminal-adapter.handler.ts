// ============================================================
// TerminalAdapter Handler
//
// Transforms framework-neutral props into terminal bindings:
// ANSI escape codes, keyboard event handlers, readline input.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const TERMINAL_KEY_MAP: Record<string, string> = {
  onclick: 'enter',
  onsubmit: 'enter',
  onkeydown: 'keypress',
  onkeyup: 'keypress',
  onfocus: 'focus',
  onblur: 'blur',
  onchange: 'input',
  onescape: 'escape',
  ontab: 'tab',
};

// ANSI color codes for class-to-style mapping
const ANSI_CLASS_MAP: Record<string, string> = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  'bg-red': '\x1b[41m',
  'bg-green': '\x1b[42m',
  'bg-yellow': '\x1b[43m',
  'bg-blue': '\x1b[44m',
};

const ANSI_RESET = '\x1b[0m';

export const terminalAdapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      return { variant: 'error', message: 'Props cannot be empty' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      return { variant: 'error', message: 'Props must be valid JSON' };
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* -> terminal accessibility hints
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> ANSI escape code sequences
      if (key === 'class') {
        const classes = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : [];
        const ansiCodes: string[] = [];
        for (const cls of classes) {
          const code = ANSI_CLASS_MAP[cls.toLowerCase()];
          if (code) ansiCodes.push(code);
        }
        normalized['__ansi'] = {
          prefix: ansiCodes.join(''),
          suffix: ansiCodes.length > 0 ? ANSI_RESET : '',
          classes,
        };
        continue;
      }

      // Event handlers -> keyboard binding map
      if (key.startsWith('on')) {
        const terminalKey = TERMINAL_KEY_MAP[key.toLowerCase()];
        if (terminalKey) {
          normalized[`keybinding:${terminalKey}`] = {
            key: terminalKey,
            handler: value,
          };
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`keybinding:${eventName}`] = {
            key: eventName,
            handler: value,
          };
        }
        continue;
      }

      // style -> ANSI escape code composition
      if (key === 'style') {
        normalized['__ansiStyle'] = value;
        continue;
      }

      // All other props pass through
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
