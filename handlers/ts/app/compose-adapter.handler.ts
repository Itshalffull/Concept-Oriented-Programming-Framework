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
        let layoutConfig: Record<string, unknown>;
        try {
          layoutConfig = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch {
          layoutConfig = { kind: value };
        }
        const kind = (layoutConfig.kind as string) || 'stack';
        const direction = (layoutConfig.direction as string) || 'column';
        const gap = layoutConfig.gap as string | undefined;
        const columns = layoutConfig.columns as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) {
          case 'grid':
            layout.container = 'LazyVerticalGrid';
            if (columns) layout.columns = columns;
            break;
          case 'split':
            layout.container = 'Row';
            layout.modifier = 'weight';
            break;
          case 'overlay':
            layout.container = 'Box';
            break;
          case 'flow':
            layout.container = 'FlowRow';
            break;
          case 'sidebar':
            layout.container = 'Scaffold';
            layout.drawer = true;
            break;
          case 'center':
            layout.container = 'Box';
            layout.alignment = 'Alignment.Center';
            break;
          case 'stack':
          default:
            layout.container = direction === 'row' ? 'Row' : 'Column';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
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
