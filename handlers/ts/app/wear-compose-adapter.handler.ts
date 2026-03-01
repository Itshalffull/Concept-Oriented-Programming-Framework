// ============================================================
// WearComposeAdapter Handler
//
// Transforms framework-neutral props into Wear OS Compose bindings:
// Modifier chains, reduced interaction set for wearables,
// rotary input, curved layouts.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const WEAR_COMPOSE_MODIFIER_MAP: Record<string, string> = {
  onclick: 'Modifier.clickable',
  onlongpress: 'Modifier.combinedClickable(onLongClick)',
  onscroll: 'Modifier.rotaryScrollable',
  onfocus: 'Modifier.onFocusChanged',
};

// Events not well-supported on Wear OS
const UNSUPPORTED_WEAR_EVENTS = new Set([
  'ondoubleclick', 'ondrag', 'ondrop', 'onhover',
  'onmouseenter', 'onmouseleave', 'onkeydown', 'onkeyup',
  'onresize', 'oncontextmenu',
]);

export const wearComposeAdapterHandler: ConceptHandler = {
  async normalize(input, storage) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      return { variant: 'error', message: 'Props cannot be empty' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      return { variant: 'error', message: 'Props must be valid JSON' };
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      // ARIA and data-* -> Compose semantics for accessibility
      if (key.startsWith('aria-')) {
        const semanticProp = key.replace('aria-', 'semantics:');
        normalized[semanticProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> Wear Compose theme reference
      if (key === 'class') {
        normalized['__themeClass'] = value;
        continue;
      }

      // Event handlers -> Wear Compose Modifier chain (reduced set)
      if (key.startsWith('on')) {
        if (UNSUPPORTED_WEAR_EVENTS.has(key.toLowerCase())) {
          normalized[`__unsupported:${key}`] = value;
          continue;
        }
        const modifier = WEAR_COMPOSE_MODIFIER_MAP[key.toLowerCase()];
        if (modifier) {
          normalized[modifier] = value;
        } else {
          const eventName = key.slice(2);
          normalized[`Modifier.${eventName.charAt(0).toLowerCase()}${eventName.slice(1)}`] = value;
        }
        continue;
      }

      // style -> Wear-specific Modifier chain (compact sizing)
      if (key === 'style') {
        normalized['__modifierChain'] = value;
        continue;
      }

      // Layout -> curved layout composables for round displays
      if (key === 'layout') {
        normalized['__curvedLayout'] = value;
        continue;
      }

      // All other props -> Composable function parameters
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
