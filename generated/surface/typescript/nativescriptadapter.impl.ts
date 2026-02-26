// generated: nativescriptadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// NativeScript prop mapping:
// onclick -> tap, onchange -> propertyChange, class -> cssClass
// Preserve data-* as custom props
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings
    if (lower === 'onclick') {
      result['tap'] = value;
    } else if (lower === 'ondblclick') {
      result['doubleTap'] = value;
    } else if (lower === 'onchange') {
      result['propertyChange'] = value;
    } else if (lower === 'onscroll') {
      result['scroll'] = value;
    } else if (lower === 'onfocus') {
      result['focus'] = value;
    } else if (lower === 'onblur') {
      result['blur'] = value;
    } else if (lower === 'onkeydown') {
      result['keyDown'] = value;
    } else if (lower === 'onkeyup') {
      result['keyUp'] = value;
    } else if (lower === 'onload') {
      result['loaded'] = value;
    } else if (lower === 'onunload') {
      result['unloaded'] = value;
    } else if (lower === 'onsubmit') {
      result['returnPress'] = value;

    // Class -> cssClass
    } else if (lower === 'class' || lower === 'classname') {
      result['cssClass'] = value;

    // Style passthrough (NativeScript supports inline CSS)
    } else if (lower === 'style') {
      result['style'] = value;

    // ARIA attributes -> NativeScript accessibility
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['automationText'] = value;
      } else if (ariaKey === 'hidden') {
        result['visibility'] = value === 'true' ? 'collapse' : 'visible';
      } else {
        result[`accessible:${ariaKey}`] = value;
      }

    // data-* attributes -> custom props
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[customKey] = value;

    // Pass through other props
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const nativescriptadapterHandler: ConceptHandler = {
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
