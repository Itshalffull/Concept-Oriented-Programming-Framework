// ToolDiscovery Concept Implementation
//
// Enables on-demand discovery of MCP tools so that only a small
// set of always-loaded tools consumes context window tokens upfront,
// while the full tool library remains searchable and describable
// on demand. Reduces upfront token usage by 95%+ for large servers.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

// ─── Search Scoring ──────────────────────────────────────

function scoreMatch(query: string, name: string, description: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  const d = description.toLowerCase();

  // Exact name match
  if (n === q) return 1.0;

  // Name starts with query
  if (n.startsWith(q)) return 0.95;

  // Name contains query as a whole word (snake_case aware)
  const nameParts = n.split('_');
  if (nameParts.some(p => p === q)) return 0.9;

  // Name contains query substring
  if (n.includes(q)) return 0.8;

  // Description word match — split query into words and check each
  const queryWords = q.split(/\s+/).filter(w => w.length > 1);
  if (queryWords.length > 0) {
    const matchCount = queryWords.filter(w => d.includes(w) || n.includes(w)).length;
    const ratio = matchCount / queryWords.length;
    if (ratio > 0) return 0.3 + (ratio * 0.4); // 0.3 to 0.7
  }

  return 0;
}

// ─── ToolDiscovery Handler ───────────────────────────────

export const toolDiscoveryHandler: ConceptHandler = {

  async register(input, storage) {
    const name = input.name as string;
    const briefDescription = input.briefDescription as string;
    const fullDescription = input.fullDescription as string;
    const category = input.category as string;
    const concept = input.concept as string;
    const action = input.action as string;
    const inputSchema = input.inputSchema as string;
    const alwaysLoaded = input.alwaysLoaded as boolean;

    const key = `tool:${name}`;
    const existing = await storage.get('tools', key);
    if (existing) {
      return { variant: 'duplicate', name };
    }

    await storage.put('tools', key, {
      toolName: name,
      briefDescription: briefDescription || '',
      fullDescription: fullDescription || '',
      category: category || 'uncategorized',
      concept: concept || '',
      action: action || '',
      inputSchema: inputSchema || '{}',
      alwaysLoaded: alwaysLoaded || false,
    });

    return { variant: 'ok', tool: name };
  },

  async searchTools(input, storage) {
    const query = input.query as string;
    const limit = (input.limit as number) || 10;

    if (!query) {
      return { variant: 'empty', query: '' };
    }

    const allTools = await storage.find('tools');

    const scored = allTools
      .map(t => ({
        name: t.toolName as string,
        description: t.briefDescription as string,
        category: t.category as string,
        score: scoreMatch(
          query,
          t.toolName as string,
          `${t.briefDescription} ${t.fullDescription}`,
        ),
      }))
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) {
      return { variant: 'empty', query };
    }

    return {
      variant: 'ok',
      tools: scored.map(({ name, description, category }) => ({
        name, description, category,
      })),
    };
  },

  async describeTools(input, storage) {
    const toolNames = input.tools as string[];
    if (!toolNames || !Array.isArray(toolNames)) {
      return { variant: 'ok', tools: [] };
    }

    const results: Array<{
      name: string;
      description: string;
      inputSchema: string;
      concept: string;
      action: string;
    }> = [];

    for (const name of toolNames) {
      const entry = await storage.get('tools', `tool:${name}`);
      if (entry) {
        results.push({
          name: entry.toolName as string,
          description: entry.fullDescription as string,
          inputSchema: entry.inputSchema as string,
          concept: entry.concept as string,
          action: entry.action as string,
        });
      }
    }

    return { variant: 'ok', tools: results };
  },

  async listCategories(_input, storage) {
    const allTools = await storage.find('tools');

    const categoryMap = new Map<string, number>();
    for (const tool of allTools) {
      const cat = tool.category as string || 'uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }

    const categories = Array.from(categoryMap.entries())
      .map(([name, toolCount]) => ({
        name,
        toolCount,
        description: `${toolCount} tools in the ${name} category`,
      }))
      .sort((a, b) => b.toolCount - a.toolCount);

    return { variant: 'ok', categories };
  },

  async getCategory(input, storage) {
    const category = input.category as string;
    if (!category) {
      return { variant: 'notfound', category: '' };
    }

    const allTools = await storage.find('tools');
    const matched = allTools.filter(t => {
      const cat = t.category as string || '';
      return cat.toLowerCase() === category.toLowerCase();
    });

    if (matched.length === 0) {
      return { variant: 'notfound', category };
    }

    return {
      variant: 'ok',
      tools: matched.map(t => ({
        name: t.toolName as string,
        description: t.briefDescription as string,
      })),
    };
  },

  async getAlwaysLoaded(_input, storage) {
    const allTools = await storage.find('tools');
    const loaded = allTools.filter(t => t.alwaysLoaded === true);

    return {
      variant: 'ok',
      tools: loaded.map(t => ({
        name: t.toolName as string,
        description: t.fullDescription as string,
        inputSchema: t.inputSchema as string,
        concept: t.concept as string,
        action: t.action as string,
      })),
    };
  },
};
