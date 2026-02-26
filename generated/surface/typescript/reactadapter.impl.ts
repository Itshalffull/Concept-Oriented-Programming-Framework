// generated: reactadapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// React-specific event map: lowercase HTML events -> camelCase React events
const REACT_EVENT_MAP: Record<string, string> = {
  onclick: 'onClick',
  onchange: 'onChange',
  onsubmit: 'onSubmit',
  oninput: 'onInput',
  onblur: 'onBlur',
  onfocus: 'onFocus',
  onkeydown: 'onKeyDown',
  onkeyup: 'onKeyUp',
  onkeypress: 'onKeyPress',
  onmousedown: 'onMouseDown',
  onmouseup: 'onMouseUp',
  onmouseover: 'onMouseOver',
  onmouseout: 'onMouseOut',
  onmouseenter: 'onMouseEnter',
  onmouseleave: 'onMouseLeave',
  ondblclick: 'onDoubleClick',
  onscroll: 'onScroll',
  onwheel: 'onWheel',
  ondrag: 'onDrag',
  ondrop: 'onDrop',
  ontouchstart: 'onTouchStart',
  ontouchend: 'onTouchEnd',
  ontouchmove: 'onTouchMove',
};

// React-specific attribute remapping
const REACT_ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  enctype: 'encType',
  crossorigin: 'crossOrigin',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  formaction: 'formAction',
};

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Preserve aria-* and data-* attributes unchanged
    if (key.startsWith('aria-') || key.startsWith('data-')) {
      result[key] = value;
    } else if (REACT_EVENT_MAP[key]) {
      result[REACT_EVENT_MAP[key]] = value;
    } else if (REACT_ATTR_MAP[key]) {
      result[REACT_ATTR_MAP[key]] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const reactadapterHandler: ConceptHandler = {
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
