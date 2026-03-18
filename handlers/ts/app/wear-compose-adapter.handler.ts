// @migrated dsl-constructs 2026-03-18
// WearComposeAdapter Handler — Transforms framework-neutral props into Wear OS Compose bindings.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const WEAR_COMPOSE_MODIFIER_MAP: Record<string, string> = { onclick: 'Modifier.clickable', onlongpress: 'Modifier.combinedClickable(onLongClick)', onscroll: 'Modifier.rotaryScrollable', onfocus: 'Modifier.onFocusChanged' };
const UNSUPPORTED_WEAR_EVENTS = new Set(['ondoubleclick','ondrag','ondrop','onhover','onmouseenter','onmouseleave','onkeydown','onkeyup','onresize','oncontextmenu']);

const _wearComposeAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string; const props = input.props as string;
    if (!props || props.trim() === '') { let p = createProgram(); return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-')) { normalized[key.replace('aria-', 'semantics:')] = value; continue; }
      if (key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['__themeClass'] = value; continue; }
      if (key.startsWith('on')) {
        if (UNSUPPORTED_WEAR_EVENTS.has(key.toLowerCase())) { normalized[`__unsupported:${key}`] = value; continue; }
        const modifier = WEAR_COMPOSE_MODIFIER_MAP[key.toLowerCase()];
        if (modifier) { normalized[modifier] = value; } else { const en = key.slice(2); normalized[`Modifier.${en.charAt(0).toLowerCase()}${en.slice(1)}`] = value; }
        continue;
      }
      if (key === 'style') { normalized['__modifierChain'] = value; continue; }
      if (key === 'layout') {
        let lc: Record<string, unknown>; try { lc = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { lc = { kind: value }; }
        const kind = (lc.kind as string) || 'stack'; const dir = (lc.direction as string) || 'column'; const gap = lc.gap as string | undefined;
        const layout: Record<string, unknown> = {};
        if (kind === 'center') { layout.container = 'Box'; layout.alignment = 'Alignment.Center'; }
        else { layout.container = dir === 'row' ? 'Row' : 'Column'; layout.curved = true; }
        if (gap) layout.spacing = gap; normalized['__curvedLayout'] = layout; continue;
      }
      if (key === 'theme') {
        let theme: Record<string, unknown>; try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>; const m3Tokens: Record<string, string> = {};
        for (const [tn, tv] of Object.entries(tokens)) { if (tn.startsWith('color-')) m3Tokens[`colorScheme.${tn.replace('color-', '')}`] = tv; else if (tn.startsWith('font-') || tn.startsWith('typography-')) m3Tokens[`typography.${tn.replace('font-', '').replace('typography-', '')}`] = tv; else m3Tokens[tn] = tv; }
        normalized['__themeTokens'] = m3Tokens; continue;
      }
      normalized[key] = value;
    }
    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const wearComposeAdapterHandler = autoInterpret(_wearComposeAdapterHandler);

