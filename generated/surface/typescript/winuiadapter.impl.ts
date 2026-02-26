// generated: winuiadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// WinUI 3 prop mapping:
// onclick -> Tapped, class -> Style, onchange -> SelectionChanged
// Map to XAML property patterns
function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();

    // Event handler mappings -> WinUI/XAML event patterns
    if (lower === 'onclick') {
      result['Tapped'] = value;
    } else if (lower === 'ondblclick') {
      result['DoubleTapped'] = value;
    } else if (lower === 'onchange') {
      result['SelectionChanged'] = value;
    } else if (lower === 'onscroll') {
      result['ViewChanged'] = value;
    } else if (lower === 'onfocus') {
      result['GotFocus'] = value;
    } else if (lower === 'onblur') {
      result['LostFocus'] = value;
    } else if (lower === 'onkeydown') {
      result['KeyDown'] = value;
    } else if (lower === 'onkeyup') {
      result['KeyUp'] = value;
    } else if (lower === 'onsubmit') {
      result['TextSubmitted'] = value;
    } else if (lower === 'onmouseover' || lower === 'onmouseenter') {
      result['PointerEntered'] = value;
    } else if (lower === 'onmouseleave') {
      result['PointerExited'] = value;
    } else if (lower === 'ondrag') {
      result['DragStarting'] = value;
    } else if (lower === 'ondrop') {
      result['Drop'] = value;
    } else if (lower === 'oncontextmenu') {
      result['RightTapped'] = value;

    // Class -> Style (XAML style resource)
    } else if (lower === 'class' || lower === 'classname') {
      result['Style'] = value;

    // Style -> inline XAML properties
    } else if (lower === 'style') {
      result['inlineStyle'] = value;

    // ARIA attributes -> WinUI automation properties
    } else if (lower.startsWith('aria-')) {
      const ariaKey = lower.slice(5);
      if (ariaKey === 'label') {
        result['AutomationProperties.Name'] = value;
      } else if (ariaKey === 'hidden') {
        result['AutomationProperties.AccessibilityView'] = value === 'true' ? 'Raw' : 'Content';
      } else if (ariaKey === 'role') {
        result['AutomationProperties.LocalizedControlType'] = value;
      } else if (ariaKey === 'describedby') {
        result['AutomationProperties.HelpText'] = value;
      } else {
        result[`AutomationProperties.${ariaKey}`] = value;
      }

    // data-* attributes -> attached properties
    } else if (lower.startsWith('data-')) {
      const customKey = key.slice(5);
      result[`Tag:${customKey}`] = value;

    // Pass through other props
    } else {
      result[key] = value;
    }
  }

  return result;
}

export const winuiadapterHandler: ConceptHandler = {
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
