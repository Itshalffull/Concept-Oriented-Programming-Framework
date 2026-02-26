// generated: wearcomposeadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// Wear Compose prop mapping:
// Same as Compose but constrained for round display.
// onclick -> Modifier.clickable, class -> Modifier chain, onchange -> onValueChange
// Adds rotaryScrollable for crown/bezel scrolling.
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings -> Wear Compose Modifier/callback patterns
    if (lower === 'onclick') {
      result['Modifier.clickable'] = value;
    } else if (lower === 'ondblclick') {
      result['Modifier.combinedClickable:onDoubleClick'] = value;
    } else if (lower === 'onchange') {
      result['onValueChange'] = value;
    } else if (lower === 'onscroll') {
      // Wear OS uses rotary input (crown/bezel) for scrolling
      result['Modifier.rotaryScrollable'] = value;
    } else if (lower === 'onfocus') {
      result['Modifier.onFocusChanged'] = value;
    } else if (lower === 'onblur') {
      result['Modifier.onFocusChanged:lost'] = value;
    } else if (lower === 'onkeydown') {
      result['Modifier.onRotaryScrollEvent'] = value;
    } else if (lower === 'onsubmit') {
      result['keyboardActions:onDone'] = value;

    // Mouse/hover events not applicable on Wear OS
    } else if (lower === 'onmouseover' || lower === 'onmouseenter' || lower === 'onmouseleave') {
      // Ignored on Wear OS - no pointer interaction

    // Drag/drop not practical on Wear OS
    } else if (lower === 'ondrag' || lower === 'ondrop') {
      // Ignored on Wear OS

    // Class -> Modifier chain
    } else if (lower === 'class' || lower === 'classname') {
      result['Modifier'] = value;

    // Style -> inline Modifier properties
    } else if (lower === 'style') {
      result['Modifier.style'] = value;

    // ARIA attributes -> Wear Compose semantics
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['Modifier.semantics:contentDescription'] = value;
      } else if (ariaKey === 'hidden') {
        result['Modifier.semantics:invisibleToUser'] = value;
      } else if (ariaKey === 'role') {
        result['Modifier.semantics:role'] = value;
      } else {
        result[`Modifier.semantics:${ariaKey}`] = value;
      }

    // data-* attributes -> custom tag modifier
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[`Modifier.testTag:${customKey}`] = value;

    // Pass through other props
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const wearcomposeadapterHandler: ConceptHandler = {
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
