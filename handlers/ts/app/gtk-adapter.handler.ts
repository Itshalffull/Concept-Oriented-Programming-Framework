// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// GTKAdapter Handler
//
// Transforms framework-neutral props into GTK bindings:
// g_signal_connect, widget property assignments.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const GTK_SIGNAL_MAP: Record<string, string> = {
  onclick: 'clicked',
  onchange: 'changed',
  onactivate: 'activate',
  onfocus: 'focus-in-event',
  onblur: 'focus-out-event',
  onkeydown: 'key-press-event',
  onkeyup: 'key-release-event',
  onmouseenter: 'enter-notify-event',
  onmouseleave: 'leave-notify-event',
  onscroll: 'scroll-event',
  ondestroy: 'destroy',
  onshow: 'show',
  onhide: 'hide',
  onresize: 'size-allocate',
};

const _gtkAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-')) {
        const atkProp = key.replace('aria-', 'atk-');
        normalized[atkProp] = value;
        continue;
      }

      if (key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }

      if (key === 'class') {
        normalized['__cssClass'] = value;
        continue;
      }

      if (key.startsWith('on')) {
        const signal = GTK_SIGNAL_MAP[key.toLowerCase()];
        if (signal) {
          normalized[`g_signal_connect:${signal}`] = {
            g_signal_connect: { signal, handler: value },
          };
        } else {
          const eventName = key.slice(2).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          normalized[`g_signal_connect:${eventName}`] = {
            g_signal_connect: { signal: eventName, handler: value },
          };
        }
        continue;
      }

      if (key === 'style') {
        normalized['__cssProperties'] = value;
        continue;
      }

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
          case 'grid':
            layout.container = 'GtkGrid';
            break;
          case 'split':
            layout.container = 'GtkPaned';
            break;
          case 'overlay':
            layout.container = 'GtkOverlay';
            break;
          case 'flow':
            layout.container = 'GtkFlowBox';
            break;
          case 'sidebar':
            layout.container = 'GtkPaned';
            break;
          case 'center':
            layout.container = 'GtkBox';
            layout.halign = 'CENTER';
            layout.valign = 'CENTER';
            break;
          case 'stack':
          default:
            layout.container = 'GtkBox';
            layout.orientation = direction === 'row' ? 'HORIZONTAL' : 'VERTICAL';
            break;
        }
        if (gap) layout.spacing = gap;
        normalized['__layout'] = layout;
        continue;
      }

      if (key === 'theme') {
        let theme: Record<string, unknown>;
        try {
          theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>;
        } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>;
        const gtkTokens: Record<string, string> = {};
        for (const [tokenName, tokenValue] of Object.entries(tokens)) {
          if (tokenName.startsWith('color-')) {
            gtkTokens[`@define-color:${tokenName.replace('color-', '')}`] = tokenValue;
          } else if (tokenName.startsWith('font-')) {
            gtkTokens[tokenName] = tokenValue;
          } else {
            gtkTokens[tokenName] = tokenValue;
          }
        }
        normalized['__themeTokens'] = gtkTokens;
        continue;
      }

      normalized[key] = { g_object_set: { property: key, value } };
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });

    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const gtkAdapterHandler = autoInterpret(_gtkAdapterHandler);

