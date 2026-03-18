// @migrated dsl-constructs 2026-03-18
// WinUIAdapter Handler — Transforms framework-neutral props into WinUI/XAML bindings.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const WINUI_EVENT_MAP: Record<string, string> = { onclick: 'Click', ondoubleclick: 'DoubleTapped', onchange: 'TextChanged', onfocus: 'GotFocus', onblur: 'LostFocus', onkeydown: 'KeyDown', onkeyup: 'KeyUp', onpointerenter: 'PointerEntered', onpointerleave: 'PointerExited', onpointerdown: 'PointerPressed', onpointerup: 'PointerReleased', onloaded: 'Loaded', onunloaded: 'Unloaded', onscroll: 'ViewChanged', ondrag: 'DragStarting', ondrop: 'Drop' };

const winUIAdapterHandlerFunctional: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string; const props = input.props as string;
    if (!props || props.trim() === '') { let p = createProgram(); return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-')) { normalized[key.replace('aria-', 'AutomationProperties.')] = value; continue; }
      if (key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['Style'] = { __xamlStyle: true, value }; continue; }
      if (key.startsWith('on')) { const we = WINUI_EVENT_MAP[key.toLowerCase()]; if (we) normalized[we] = value; else { const en = key.slice(2); normalized[en.charAt(0).toUpperCase() + en.slice(1)] = value; } continue; }
      if (key === 'style') { normalized['__dependencyProperties'] = value; continue; }
      if (key === 'layout') {
        let lc: Record<string, unknown>; try { lc = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { lc = { kind: value }; }
        const kind = (lc.kind as string) || 'stack'; const dir = (lc.direction as string) || 'column'; const gap = lc.gap as string | undefined; const cols = lc.columns as string | undefined; const rows = lc.rows as string | undefined;
        const layout: Record<string, unknown> = {};
        switch (kind) { case 'grid': layout.container = 'Grid'; if (cols) layout.columnDefinitions = cols; if (rows) layout.rowDefinitions = rows; break; case 'split': layout.container = 'SplitView'; break; case 'overlay': layout.container = 'Canvas'; break; case 'flow': layout.container = 'ItemsWrapGrid'; break; case 'sidebar': layout.container = 'NavigationView'; break; case 'center': layout.container = 'Grid'; layout.horizontalAlignment = 'Center'; layout.verticalAlignment = 'Center'; break; default: layout.container = 'StackPanel'; layout.orientation = dir === 'row' ? 'Horizontal' : 'Vertical'; break; }
        if (gap) layout.spacing = gap; normalized['__layout'] = layout; continue;
      }
      if (key === 'theme') { let theme: Record<string, unknown>; try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; } const tokens = (theme.tokens || {}) as Record<string, string>; const xamlTokens: Record<string, string> = {}; for (const [tn, tv] of Object.entries(tokens)) { const pk = tn.replace(/(^|-)([a-z])/g, (_, _sep, c) => c.toUpperCase()); xamlTokens[`ThemeResource:${pk}`] = tv; } normalized['__themeTokens'] = xamlTokens; continue; }
      normalized[key] = value;
    }
    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const winUIAdapterHandler = wrapFunctional(winUIAdapterHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { winUIAdapterHandlerFunctional };
