// generated: watchkitadapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// WatchKit (watchOS) prop mapping:
// Similar to SwiftUI but constrained for watch: onclick -> onTapGesture,
// class -> viewModifier. Adds digitalCrownRotation for scroll events.
// Constrained subset suitable for small watch displays.
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings -> SwiftUI/WatchKit gesture patterns
    if (lower === 'onclick') {
      result['onTapGesture'] = value;
    } else if (lower === 'ondblclick') {
      result['onTapGesture:count:2'] = value;
    } else if (lower === 'onchange') {
      result['onChange'] = value;
    } else if (lower === 'onscroll') {
      // WatchKit uses Digital Crown for scrolling
      result['digitalCrownRotation'] = value;
    } else if (lower === 'onfocus') {
      result['onFocusChange'] = value;
    } else if (lower === 'onsubmit') {
      result['onSubmit'] = value;

    // Mouse/hover events not applicable on watchOS
    } else if (lower === 'onmouseover' || lower === 'onmouseenter' || lower === 'onmouseleave') {
      // Ignored on watchOS - no pointer interaction

    // Drag/drop not supported on watchOS
    } else if (lower === 'ondrag' || lower === 'ondrop') {
      // Ignored on watchOS

    // Class -> viewModifier
    } else if (lower === 'class' || lower === 'classname') {
      result['viewModifier'] = value;

    // Style -> inline modifier chain
    } else if (lower === 'style') {
      result['modifierStyle'] = value;

    // ARIA attributes -> watchOS accessibility
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['accessibilityLabel'] = value;
      } else if (ariaKey === 'hidden') {
        result['accessibilityHidden'] = value;
      } else if (ariaKey === 'role') {
        result['accessibilityAddTraits'] = value;
      } else {
        result[`accessibility:${ariaKey}`] = value;
      }

    // data-* attributes -> custom environment keys
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

export const watchkitadapterHandler: ConceptHandler = {
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
