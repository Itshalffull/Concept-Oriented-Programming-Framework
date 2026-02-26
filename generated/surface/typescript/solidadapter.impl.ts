// generated: solidadapter.handler.ts
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'output';

// Solid uses on:event prefix for event handlers
function toSolidEvent(key: string): string | null {
  if (key.startsWith('on') && key.length > 2 && key[2] !== ':' && !key.startsWith('on:')) {
    const eventName = key.slice(2).toLowerCase();
    return `on:${eventName}`;
  }
  return null;
}

// Solid keeps `class` as-is (no className remapping)
// Solid-specific attribute remapping
const SOLID_ATTR_MAP: Record<string, string> = {
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
};

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Preserve aria-* and data-* attributes unchanged
    if (key.startsWith('aria-') || key.startsWith('data-')) {
      result[key] = value;
    } else {
      const solidEvent = toSolidEvent(key);
      if (solidEvent) {
        result[solidEvent] = value;
      } else if (SOLID_ATTR_MAP[key]) {
        result[SOLID_ATTR_MAP[key]] = value;
      } else {
        // class stays as class, style stays as style, etc.
        result[key] = value;
      }
    }
  }
  return result;
}

export const solidadapterHandler: ConceptHandler = {
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
