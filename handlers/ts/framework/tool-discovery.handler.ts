// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ToolDiscovery Concept Implementation
//
// Enables on-demand discovery of MCP tools so that only a small
// set of always-loaded tools consumes context window tokens upfront.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Search Scoring ──────────────────────────────────────

function scoreMatch(query: string, name: string, description: string): number {
  const q = query.toLowerCase(); const n = name.toLowerCase(); const d = description.toLowerCase();
  if (n === q) return 1.0;
  if (n.startsWith(q)) return 0.95;
  const nameParts = n.split('_');
  if (nameParts.some(p => p === q)) return 0.9;
  if (n.includes(q)) return 0.8;
  const queryWords = q.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length > 0) { const matchCount = queryWords.filter(w => d.includes(w) || n.includes(w)).length; const ratio = matchCount / queryWords.length; if (ratio > 0) return 0.3 + (ratio * 0.4); }
  return 0;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const key = `tool:${name}`;

    let p = createProgram();
    p = get(p, 'tools', key, 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'duplicate', { name }),
      (elseP) => {
        let p2 = put(elseP, 'tools', key, {
          toolName: name,
          briefDescription: (input.briefDescription as string) || '',
          fullDescription: (input.fullDescription as string) || '',
          category: (input.category as string) || 'uncategorized',
          concept: (input.concept as string) || '',
          action: (input.action as string) || '',
          inputSchema: (input.inputSchema as string) || '{}',
          alwaysLoaded: (input.alwaysLoaded as boolean) || false,
        });
        return complete(p2, 'ok', { tool: name });
      },
    ) as StorageProgram<Result>;
  },

  searchTools(input: Record<string, unknown>) {
    if (!input.query || (typeof input.query === 'string' && (input.query as string).trim() === '')) {
      return complete(createProgram(), 'empty', { message: 'query is required' }) as StorageProgram<Result>;
    }
    const query = input.query as string;
    const limit = (input.limit as number) || 10;

    if (!query) { const p = createProgram(); return complete(p, 'empty', { query: '' }) as StorageProgram<Result>; }

    let p = createProgram();
    p = find(p, 'tools', {}, 'allTools');

    return completeFrom(p, '', (bindings) => {
      const allTools = bindings.allTools as Array<Record<string, unknown>>;
      const scored = allTools
        .map(t => ({ name: t.toolName as string, description: t.briefDescription as string, category: t.category as string, score: scoreMatch(query, t.toolName as string, `${t.briefDescription} ${t.fullDescription}`) }))
        .filter(t => t.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);

      if (scored.length === 0) return { variant: 'empty', query };
      return { variant: 'ok', tools: scored.map(({ name, description, category }) => ({ name, description, category })) };
    }) as StorageProgram<Result>;
  },

  describeTools(input: Record<string, unknown>) {
    if (!input.tools || (typeof input.tools === 'string' && (input.tools as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tools is required' }) as StorageProgram<Result>;
    }
    let toolNames: string[];
    const rawTools = input.tools;
    if (Array.isArray(rawTools)) {
      toolNames = rawTools as string[];
    } else if (rawTools && typeof rawTools === 'object' && (rawTools as any).type === 'list') {
      toolNames = ((rawTools as any).items || []).map((i: any) => i.value || i);
    } else {
      toolNames = [];
    }
    if (toolNames.length === 0) { const p = createProgram(); return complete(p, 'error', { message: 'tools list is empty' }) as StorageProgram<Result>; }

    // Fetch all tools and filter in pure computation
    let p = createProgram();
    p = find(p, 'tools', {}, 'allTools');

    return completeFrom(p, 'ok', (bindings) => {
      const allTools = bindings.allTools as Array<Record<string, unknown>>;
      const nameSet = new Set(toolNames.map(n => `tool:${n}`));
      const results = allTools
        .filter(t => nameSet.has(`tool:${t.toolName}`))
        .map(t => ({ name: t.toolName as string, description: t.fullDescription as string, inputSchema: t.inputSchema as string, concept: t.concept as string, action: t.action as string }));
      return { tools: results };
    }) as StorageProgram<Result>;
  },

  listCategories(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tools', {}, 'allTools');

    return completeFrom(p, 'ok', (bindings) => {
      const allTools = bindings.allTools as Array<Record<string, unknown>>;
      const categoryMap = new Map<string, number>();
      for (const tool of allTools) { const cat = tool.category as string || 'uncategorized'; categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1); }
      const categories = Array.from(categoryMap.entries()).map(([name, toolCount]) => ({ name, toolCount, description: `${toolCount} tools in the ${name} category` })).sort((a, b) => b.toolCount - a.toolCount);
      return { categories };
    }) as StorageProgram<Result>;
  },

  getCategory(input: Record<string, unknown>) {
    if (!input.category || (typeof input.category === 'string' && (input.category as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'category is required' }) as StorageProgram<Result>;
    }
    const category = input.category as string;
    if (!category) { const p = createProgram(); return complete(p, 'notfound', { category: '' }) as StorageProgram<Result>; }

    let p = createProgram();
    p = find(p, 'tools', {}, 'allTools');

    return completeFrom(p, '', (bindings) => {
      const allTools = bindings.allTools as Array<Record<string, unknown>>;
      const matched = allTools.filter(t => ((t.category as string) || '').toLowerCase() === category.toLowerCase());
      if (matched.length === 0) return { variant: 'notfound', category };
      return { variant: 'ok', tools: matched.map(t => ({ name: t.toolName as string, description: t.briefDescription as string })) };
    }) as StorageProgram<Result>;
  },

  getAlwaysLoaded(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tools', {}, 'allTools');

    return completeFrom(p, 'ok', (bindings) => {
      const allTools = bindings.allTools as Array<Record<string, unknown>>;
      const loaded = allTools.filter(t => t.alwaysLoaded === true);
      return { tools: loaded.map(t => ({ name: t.toolName as string, description: t.fullDescription as string, inputSchema: t.inputSchema as string, concept: t.concept as string, action: t.action as string })) };
    }) as StorageProgram<Result>;
  },
};

export const toolDiscoveryHandler = autoInterpret(_handler);
