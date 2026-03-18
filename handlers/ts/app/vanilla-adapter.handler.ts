// @migrated dsl-constructs 2026-03-18
// VanillaAdapter Handler — Transforms framework-neutral props into vanilla DOM APIs.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, put, complete, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _vanillaAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string; const props = input.props as string;
    if (!props || props.trim() === '') { let p = createProgram(); return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(props); } catch { let p = createProgram(); return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-') || key.startsWith('data-')) { normalized[key] = value; continue; }
      if (key === 'class') { normalized['classList'] = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : value; continue; }
      if (key.startsWith('on')) { const en = key.slice(2).toLowerCase(); normalized[`addEventListener:${en}`] = { addEventListener: { event: en, handler: value } }; continue; }
      if (key === 'style') { normalized['style'] = { __propertyAssignment: true, value }; continue; }
      if (key === 'layout') {
        let lc: Record<string, unknown>; try { lc = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { lc = { kind: value }; }
        const kind = (lc.kind as string) || 'stack'; const dir = (lc.direction as string) || 'column'; const gap = lc.gap as string | undefined; const cols = lc.columns as string | undefined; const rows = lc.rows as string | undefined;
        const layout: Record<string, string> = {};
        switch (kind) { case 'grid': layout.display = 'grid'; if (cols) layout.gridTemplateColumns = cols; if (rows) layout.gridTemplateRows = rows; break; case 'split': layout.display = 'flex'; layout.flexDirection = 'row'; break; case 'overlay': layout.position = 'relative'; break; case 'flow': layout.display = 'flex'; layout.flexWrap = 'wrap'; break; case 'sidebar': layout.display = 'grid'; layout.gridTemplateColumns = 'auto 1fr'; break; case 'center': layout.display = 'flex'; layout.justifyContent = 'center'; layout.alignItems = 'center'; break; default: layout.display = 'flex'; layout.flexDirection = dir; break; }
        if (gap) layout.gap = gap; normalized['__layout'] = layout; continue;
      }
      if (key === 'theme') { let theme: Record<string, unknown>; try { theme = typeof value === 'string' ? JSON.parse(value as string) : value as Record<string, unknown>; } catch { continue; } const tokens = (theme.tokens || {}) as Record<string, string>; const cssVars: Record<string, string> = {}; for (const [tn, tv] of Object.entries(tokens)) cssVars[`--${tn}`] = tv; normalized['__themeTokens'] = cssVars; continue; }
      normalized[key] = { setAttribute: { name: key, value } };
    }
    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const vanillaAdapterHandler = autoInterpret(_vanillaAdapterHandler);

