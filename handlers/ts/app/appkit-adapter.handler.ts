// ============================================================
// AppKitAdapter Handler
//
// Transforms framework-neutral props into macOS AppKit bindings:
// NSControl target/action, NSView subclassing patterns.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const APPKIT_ACTION_MAP: Record<string, string> = {
  onclick: 'click:',
  ondoubleclick: 'doubleClick:',
  onchange: 'controlTextDidChange:',
  onsubmit: 'submitAction:',
  onselect: 'selectItem:',
  onfocus: 'becomeFirstResponder',
  onblur: 'resignFirstResponder',
};

export const appKitAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* pass through as accessibility properties
      if (key.startsWith('aria-')) {
        const accessibilityProp = key.replace('aria-', 'accessibility');
        normalized[accessibilityProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> NSView class hierarchy
      if (key === 'class') {
        normalized['__viewClass'] = value;
        continue;
      }

      // Event handlers -> target/action pattern
      if (key.startsWith('on')) {
        const action = APPKIT_ACTION_MAP[key.toLowerCase()];
        if (action) {
          normalized[`__action:${action}`] = { target: value, action };
        } else {
          const eventName = key.slice(2).toLowerCase();
          normalized[`__action:${eventName}:`] = { target: value, action: `${eventName}:` };
        }
        continue;
      }

      // style -> NSView property assignments
      if (key === 'style') {
        normalized['__viewProperties'] = value;
        continue;
      }

      // All other props -> NSView configuration
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
