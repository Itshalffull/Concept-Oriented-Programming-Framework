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
        let layoutConfig: Record<string, unknown>;
        try {
          layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch {
          layoutConfig = { kind: value };
        }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'center':
            layout.container = 'Box';
            layout.alignment = 'Alignment.Center';
            break;
          case 'stack':
          default:
            // Wear OS: most layout kinds fall back to curved Column/Row
            layout.container = direction === 'row' ? 'Row' : 'Column';
            layout.curved = true;
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__curvedLayout'] = layout;
        continue;
      }

      // Theme -> Material3 theme keys (colorScheme, typography)
      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const m3Tokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            m3Tokens[`colorScheme.${tokenName.replace('color-', '')}`] = tokenValue;
          } else if (tokenName.startsWith('font-') || tokenName.startsWith('typography-')) {
            const key = tokenName.replace('font-', '').replace('typography-', '');
            m3Tokens[`typography.${key}`] = tokenValue;
          } else {
            m3Tokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = m3Tokens;
        continue;
      }

      // All other props -> Composable function parameters
      normalized[key] = value;
    }

    await storage.put('output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return { variant: 'ok', adapter, normalized: JSON.stringify(normalized) };
  },
};
