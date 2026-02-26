// generated: appkitadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// AppKit prop mapping:
// onclick -> target-action:click, class -> appearance, onchange -> target-action:change
// Map to NSView target-action pattern
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings -> AppKit target-action / delegate patterns
    if (lower === 'onclick') {
      result['target-action:click'] = value;
    } else if (lower === 'ondblclick') {
      result['target-action:doubleClick'] = value;
    } else if (lower === 'onchange') {
      result['target-action:change'] = value;
    } else if (lower === 'onscroll') {
      result['notification:boundsDidChange'] = value;
    } else if (lower === 'onfocus') {
      result['notification:didBecomeFirstResponder'] = value;
    } else if (lower === 'onblur') {
      result['notification:didResignFirstResponder'] = value;
    } else if (lower === 'onkeydown') {
      result['override:keyDown'] = value;
    } else if (lower === 'onkeyup') {
      result['override:keyUp'] = value;
    } else if (lower === 'onsubmit') {
      result['target-action:submit'] = value;
    } else if (lower === 'onmouseover' || lower === 'onmouseenter') {
      result['override:mouseEntered'] = value;
    } else if (lower === 'onmouseleave') {
      result['override:mouseExited'] = value;
    } else if (lower === 'ondrag') {
      result['protocol:draggingSource'] = value;
    } else if (lower === 'ondrop') {
      result['protocol:draggingDestination'] = value;
    } else if (lower === 'oncontextmenu') {
      result['override:rightMouseDown'] = value;

    // Class -> appearance (NSAppearance)
    } else if (lower === 'class' || lower === 'classname') {
      result['appearance'] = value;

    // Style -> inline view properties
    } else if (lower === 'style') {
      result['viewProperties'] = value;

    // ARIA attributes -> NSAccessibility protocol
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['NSAccessibility.label'] = value;
      } else if (ariaKey === 'hidden') {
        result['NSAccessibility.isHidden'] = value;
      } else if (ariaKey === 'role') {
        result['NSAccessibility.role'] = value;
      } else if (ariaKey === 'describedby') {
        result['NSAccessibility.help'] = value;
      } else {
        result[`NSAccessibility.${ariaKey}`] = value;
      }

    // data-* attributes -> custom identifiers / user info
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[`identifier:${customKey}`] = value;

    // Pass through other props
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const appkitadapterHandler: ConceptHandler = {
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
