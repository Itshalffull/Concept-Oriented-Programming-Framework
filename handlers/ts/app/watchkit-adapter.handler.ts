// @migrated dsl-constructs 2026-03-18
// WatchKitAdapter Handler — Transforms framework-neutral props into legacy WatchKit bindings.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const WATCHKIT_ACTION_MAP: Record<string, string> = { onclick: 'IBAction:buttonTapped', onchange: 'IBAction:valueChanged', onselect: 'IBAction:itemSelected' };
const UNSUPPORTED_WATCHKIT_EVENTS = new Set(['ondoubleclick','onlongpress','ondrag','ondrop','onhover','onmouseenter','onmouseleave','onkeydown','onkeyup','onresize','oncontextmenu','onscroll','onfocus','onblur']);

const _watchKitAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string; const props = input.props as string;
    if (!props || props.trim() === '') { let p = createProgram(); return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-')) { normalized[key.replace('aria-', 'accessibility')] = value; continue; }
      if (key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['__interfaceObject'] = value; continue; }
      if (key.startsWith('on')) {
        if (UNSUPPORTED_WATCHKIT_EVENTS.has(key.toLowerCase())) { normalized[`__unsupported:${key}`] = value; continue; }
        const wkAction = WATCHKIT_ACTION_MAP[key.toLowerCase()];
        if (wkAction) { normalized[wkAction] = { __ibAction: true, handler: value }; }
        else { const en = key.slice(2).toLowerCase(); normalized[`IBAction:${en}`] = { __ibAction: true, handler: value }; }
        continue;
      }
      if (key === 'style') { normalized['__wkProperties'] = value; continue; }
      if (key === 'layout') {
        let lc: Record<string, unknown>; try { lc = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { lc = { kind: value }; }
        const dir = (lc.direction as string) || 'column'; const gap = lc.gap as string | undefined;
        const layout: Record<string, unknown> = { container: 'WKInterfaceGroup', orientation: dir === 'row' ? 'horizontal' : 'vertical' };
        if (gap) layout.spacing = gap; normalized['__layout'] = layout; continue;
      }
      if (key === 'theme') {
        let theme: Record<string, unknown>; try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; }
        const tokens = (theme.tokens || {}) as Record<string, string>; const wkTokens: Record<string, string> = {};
        for (const [tn, tv] of Object.entries(tokens)) { if (tn.startsWith('color-')) wkTokens[`${tn.replace('color-', '')}Color`] = tv; else if (tn.startsWith('spacing-') || tn.startsWith('dimension-')) wkTokens[tn] = tv; }
        normalized['__themeTokens'] = wkTokens; continue;
      }
      normalized[key] = value;
    }
    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const watchKitAdapterHandler = autoInterpret(_watchKitAdapterHandler);

