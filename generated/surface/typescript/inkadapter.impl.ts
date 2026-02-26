// generated: inkadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// Ink (terminal UI) specific event mapping
const INK_EVENT_MAP: Record<string, string> = {
  onclick: 'onPress',
  onkeydown: 'onKeyDown',
  onkeyup: 'onKeyUp',
  onfocus: 'onFocus',
  onblur: 'onBlur',
};

// DOM-specific attributes that should be ignored in Ink
const DOM_ONLY_ATTRS = new Set([
  'for',
  'tabindex',
  'readonly',
  'maxlength',
  'cellpadding',
  'cellspacing',
  'colspan',
  'rowspan',
  'enctype',
  'crossorigin',
  'autocomplete',
  'autofocus',
  'formaction',
  'href',
  'src',
  'alt',
  'action',
  'method',
  'target',
  'rel',
  'type',
]);

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Preserve data-* as custom props
    if (key.startsWith('data-')) {
      result[key] = value;
    } else if (key.startsWith('aria-')) {
      // Ignore aria-* in terminal context (not applicable)
      continue;
    } else if (INK_EVENT_MAP[key]) {
      result[INK_EVENT_MAP[key]] = value;
    } else if (key === 'class') {
      // Ink uses style objects, not CSS classes. Map class -> style.
      result['style'] = value;
    } else if (key === 'style') {
      result['style'] = value;
    } else if (DOM_ONLY_ATTRS.has(key)) {
      // Ignore DOM-specific attributes in terminal context
      continue;
    } else if (key.startsWith('on') && key.length > 2) {
      // Unknown event handlers - skip unsupported ones
      continue;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const inkadapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const propsStr = input.props as string;

    if (!propsStr || propsStr.trim() === '') {
      return { variant: 'error', message: 'Props string is empty' };
    }

    let props: Record<string, unknown>;
    try {
      props = JSON.parse(propsStr) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Invalid JSON in props string' };
    }

    const normalized = normalizeProps(props);
    const normalizedStr = JSON.stringify(normalized);

    await storage.put(RELATION, adapter, {
      adapter,
      outputs: normalizedStr,
    });

    return { variant: 'ok', adapter, normalized: normalizedStr };
  },
};
