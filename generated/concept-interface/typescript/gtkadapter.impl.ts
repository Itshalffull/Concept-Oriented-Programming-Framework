// generated: gtkadapter.impl.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// GTK 4 prop mapping:
// onclick -> signal:clicked, class -> cssClass, onchange -> signal:changed
// Map to GSignal patterns
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings -> GTK signal patterns
    if (lower === 'onclick') {
      result['signal:clicked'] = value;
    } else if (lower === 'ondblclick') {
      result['gesture:pressed:n_press:2'] = value;
    } else if (lower === 'onchange') {
      result['signal:changed'] = value;
    } else if (lower === 'onscroll') {
      result['controller:scroll'] = value;
    } else if (lower === 'onfocus') {
      result['controller:focus-in'] = value;
    } else if (lower === 'onblur') {
      result['controller:focus-out'] = value;
    } else if (lower === 'onkeydown') {
      result['controller:key-pressed'] = value;
    } else if (lower === 'onkeyup') {
      result['controller:key-released'] = value;
    } else if (lower === 'onsubmit') {
      result['signal:activate'] = value;
    } else if (lower === 'onmouseover' || lower === 'onmouseenter') {
      result['controller:enter'] = value;
    } else if (lower === 'onmouseleave') {
      result['controller:leave'] = value;
    } else if (lower === 'ondrag') {
      result['controller:drag-begin'] = value;
    } else if (lower === 'ondrop') {
      result['controller:drop'] = value;
    } else if (lower === 'oncontextmenu') {
      result['gesture:pressed:button:3'] = value;

    // Class -> cssClass (GTK CSS class)
    } else if (lower === 'class' || lower === 'classname') {
      result['cssClass'] = value;

    // Style -> inline CSS properties via GtkCssProvider
    } else if (lower === 'style') {
      result['cssProvider:inline'] = value;

    // ARIA attributes -> GTK accessibility (ATK/AT-SPI)
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['accessible:label'] = value;
      } else if (ariaKey === 'hidden') {
        result['accessible:hidden'] = value;
      } else if (ariaKey === 'role') {
        result['accessible:role'] = value;
      } else if (ariaKey === 'describedby') {
        result['accessible:description'] = value;
      } else {
        result[`accessible:${ariaKey}`] = value;
      }

    // data-* attributes -> GObject data / custom properties
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[`g_object_set_data:${customKey}`] = value;

    // Pass through other props
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const gtkadapterHandler: ConceptHandler = {
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
