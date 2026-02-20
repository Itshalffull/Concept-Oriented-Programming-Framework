// generated: swiftuiadapter.impl.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// SwiftUI prop mapping:
// onclick -> onTapGesture, class -> viewModifier, onchange -> onChange
// Map to SwiftUI view modifier patterns
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings -> SwiftUI gesture/modifier patterns
    if (lower === 'onclick') {
      result['onTapGesture'] = value;
    } else if (lower === 'ondblclick') {
      result['onTapGesture:count:2'] = value;
    } else if (lower === 'onchange') {
      result['onChange'] = value;
    } else if (lower === 'onscroll') {
      result['onScroll'] = value;
    } else if (lower === 'onfocus') {
      result['onFocusChange'] = value;
    } else if (lower === 'onsubmit') {
      result['onSubmit'] = value;
    } else if (lower === 'onmouseover' || lower === 'onmouseenter') {
      result['onHover'] = value;
    } else if (lower === 'ondrag') {
      result['onDrag'] = value;
    } else if (lower === 'ondrop') {
      result['onDrop'] = value;

    // Class -> viewModifier (SwiftUI applies styles through modifiers)
    } else if (lower === 'class' || lower === 'classname') {
      result['viewModifier'] = value;

    // Style -> inline modifier chain
    } else if (lower === 'style') {
      result['modifierStyle'] = value;

    // ARIA attributes -> SwiftUI accessibility modifiers
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['accessibilityLabel'] = value;
      } else if (ariaKey === 'hidden') {
        result['accessibilityHidden'] = value;
      } else if (ariaKey === 'role') {
        result['accessibilityAddTraits'] = value;
      } else if (ariaKey === 'valuenow') {
        result['accessibilityValue'] = value;
      } else {
        result[`accessibility:${ariaKey}`] = value;
      }

    // data-* attributes -> custom environment or preference keys
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[`environment:${customKey}`] = value;

    // Pass through other props as modifiers
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const swiftuiadapterHandler: ConceptHandler = {
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
