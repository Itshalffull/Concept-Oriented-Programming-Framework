// ============================================================
// ComposeAdapter Handler
//
// Transforms framework-neutral props into Jetpack Compose bindings:
// Modifier chains, onClick, Composable function parameters.
// ============================================================

import type { ConceptHandler } from '@clef/runtime';

const COMPOSE_MODIFIER_MAP: Record<string, string> = {
  onclick: 'Modifier.clickable',
  onlongpress: 'Modifier.combinedClickable(onLongClick)',
  ondoubleclick: 'Modifier.combinedClickable(onDoubleClick)',
  ondrag: 'Modifier.draggable',
  onscroll: 'Modifier.verticalScroll',
  onfocus: 'Modifier.onFocusChanged',
};

export const composeAdapterHandler: ConceptHandler = {
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
      // ARIA and data-* -> Compose semantics
      if (key.startsWith('aria-')) {
        const semanticProp = key.replace('aria-', 'semantics:');
        normalized[semanticProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      // class -> Compose does not have CSS classes
      if (key === 'class') {
        normalized['__themeClass'] = value;
        continue;
      }

      // Event handlers -> Modifier chain entries
      if (key.startsWith('on')) {
        const modifier = COMPOSE_MODIFIER_MAP[key.toLowerCase()];
        if (modifier) {
          normalized[modifier] = value;
        } else {
          // Generic modifier fallback
          const eventName = key.slice(2);
          normalized[`Modifier.${eventName.charAt(0).toLowerCase()}${eventName.slice(1)}`] = value;
        }
        continue;
      }

      // style -> Modifier chain for visual properties
      if (key === 'style') {
        normalized['__modifierChain'] = value;
        continue;
      }

      // Layout -> Compose layout composables
      if (key === 'layout') {
        normalized['__layout'] = value; // "Column", "Row", "Box"
        continue;
      }

      // All other props -> Composable function parameters
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
