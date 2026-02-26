// generated: reactnativeadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// React Native prop mapping:
// onclick -> onPress, class -> style (StyleSheet), onchange -> onValueChange
// Ignore aria-* (use RN accessible/accessibilityLabel instead)
// Preserve data-* as custom props (stripped of "data-" prefix)
// Ignore DOM-specific attributes (e.g. href, tabindex, for)
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const DOM_SPECIFIC = new Set([
    'href', 'tabindex', 'for', 'action', 'method', 'target',
    'rel', 'type', 'name', 'placeholder', 'autofocus',
  ]);

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings
    if (lower === 'onclick') {
      result['onPress'] = value;
    } else if (lower === 'onchange') {
      result['onValueChange'] = value;
    } else if (lower === 'ondblclick') {
      result['onLongPress'] = value;
    } else if (lower === 'onmouseover' || lower === 'onmouseenter') {
      // No direct RN equivalent; skip
    } else if (lower === 'onscroll') {
      result['onScroll'] = value;
    } else if (lower === 'onfocus') {
      result['onFocus'] = value;
    } else if (lower === 'onblur') {
      result['onBlur'] = value;
    } else if (lower === 'onkeydown' || lower === 'onkeyup' || lower === 'onkeypress') {
      result['onKeyPress'] = value;
    } else if (lower === 'onsubmit') {
      result['onSubmitEditing'] = value;

    // Class -> style (StyleSheet reference)
    } else if (lower === 'class' || lower === 'classname') {
      result['style'] = { _styleSheet: value };

    // Style passthrough
    } else if (lower === 'style') {
      result['style'] = value;

    // ARIA attributes -> RN accessibility props
    } else if (lower.startsWith('aria-')) {
      // Ignore aria-* in RN; use accessible/accessibilityLabel instead
      // Map common ones to RN equivalents
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['accessibilityLabel'] = value;
      } else if (ariaKey === 'hidden') {
        result['accessibilityElementsHidden'] = value;
      } else if (ariaKey === 'role') {
        result['accessibilityRole'] = value;
      }
      // Other aria-* attributes are intentionally ignored

    // data-* attributes -> custom props
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[customKey] = value;

    // DOM-specific attributes are ignored
    } else if (DOM_SPECIFIC.has(lower)) {
      // Skip DOM-specific attributes

    // Pass through other props
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const reactnativeadapterHandler: ConceptHandler = {
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
