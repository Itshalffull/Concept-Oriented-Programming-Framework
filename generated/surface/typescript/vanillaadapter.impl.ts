// generated: vanillaadapter.handler.ts
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'output';

// Vanilla DOM uses addEventListener for event binding
function toVanillaEvent(key: string): string | null {
  if (key.startsWith('on') && key.length > 2 && !key.startsWith('on:')) {
    const eventName = key.slice(2).toLowerCase();
    return `addEventListener:${eventName}`;
  }
  return null;
}

// Vanilla DOM attribute remapping
const VANILLA_ATTR_MAP: Record<string, string> = {
  class: 'classList:add',
};

function normalizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    // Preserve aria-* and data-* attributes unchanged (for setAttribute)
    if (key.startsWith('aria-') || key.startsWith('data-')) {
      result[key] = value;
    } else {
      const vanillaEvent = toVanillaEvent(key);
      if (vanillaEvent) {
        result[vanillaEvent] = value;
      } else if (VANILLA_ATTR_MAP[key]) {
        result[VANILLA_ATTR_MAP[key]] = value;
      } else {
        // Keep attribute names as-is for setAttribute
        result[key] = value;
      }
    }
  }
  return result;
}

export const vanillaadapterHandler: ConceptHandler = {
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
