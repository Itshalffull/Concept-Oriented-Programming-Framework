// SearchIndex Concept Implementation
// Build and maintain full-text and faceted search indexes with a pluggable processor pipeline.
import type { ConceptHandler } from '@clef/runtime';

export const searchIndexHandler: ConceptHandler = {
  async createIndex(input, storage) {
    const index = input.index as string;
    const config = input.config as string;

    // Existence check: index must not already exist
    const existing = await storage.get('index', index);
    if (existing) {
      return { variant: 'exists', index };
    }

    await storage.put('index', index, {
      index,
      config,
      processors: JSON.stringify([]),
      items: JSON.stringify({}),
    });

    return { variant: 'ok', index };
  },

  async indexItem(input, storage) {
    const index = input.index as string;
    const item = input.item as string;
    const data = input.data as string;

    const record = await storage.get('index', index);
    if (!record) {
      return { variant: 'notfound', index };
    }

    // Process the item through the processor pipeline
    const processors: string[] = JSON.parse(record.processors as string);
    let processedData = data;
    for (const processor of processors) {
      // Apply processor transformations (lowercase, trim, etc.)
      if (processor === 'lowercase') {
        processedData = processedData.toLowerCase();
      } else if (processor === 'trim') {
        processedData = processedData.trim();
      }
    }

    // Add the item to the index
    const items: Record<string, string> = JSON.parse(record.items as string);
    items[item] = processedData;

    await storage.put('index', index, {
      ...record,
      items: JSON.stringify(items),
    });

    return { variant: 'ok', index };
  },

  async removeItem(input, storage) {
    const index = input.index as string;
    const item = input.item as string;

    const record = await storage.get('index', index);
    if (!record) {
      return { variant: 'notfound', index };
    }

    const items: Record<string, string> = JSON.parse(record.items as string);
    delete items[item];

    await storage.put('index', index, {
      ...record,
      items: JSON.stringify(items),
    });

    return { variant: 'ok', index };
  },

  async search(input, storage) {
    const index = input.index as string;
    const query = input.query as string;

    const record = await storage.get('index', index);
    if (!record) {
      return { variant: 'notfound', index };
    }

    const items: Record<string, string> = JSON.parse(record.items as string);
    const queryLower = query.toLowerCase();

    // Simple full-text search: score items by occurrence of query terms
    const results: Array<{ item: string; score: number }> = [];
    for (const [itemId, data] of Object.entries(items)) {
      const dataLower = data.toLowerCase();
      if (dataLower.includes(queryLower)) {
        // Calculate a basic relevance score based on term frequency
        const occurrences = dataLower.split(queryLower).length - 1;
        results.push({ item: itemId, score: occurrences });
      }
    }

    // Sort by relevance score descending
    results.sort((a, b) => b.score - a.score);

    return { variant: 'ok', results: JSON.stringify(results) };
  },

  async addProcessor(input, storage) {
    const index = input.index as string;
    const processor = input.processor as string;

    const record = await storage.get('index', index);
    if (!record) {
      return { variant: 'notfound', index };
    }

    const processors: string[] = JSON.parse(record.processors as string);
    processors.push(processor);

    await storage.put('index', index, {
      ...record,
      processors: JSON.stringify(processors),
    });

    return { variant: 'ok', index };
  },

  async reindex(input, storage) {
    const index = input.index as string;

    const record = await storage.get('index', index);
    if (!record) {
      return { variant: 'notfound', index };
    }

    const processors: string[] = JSON.parse(record.processors as string);
    const items: Record<string, string> = JSON.parse(record.items as string);

    // Re-process all items through the current processor pipeline
    let count = 0;
    const reindexedItems: Record<string, string> = {};

    for (const [itemId, data] of Object.entries(items)) {
      let processedData = data;
      for (const processor of processors) {
        if (processor === 'lowercase') {
          processedData = processedData.toLowerCase();
        } else if (processor === 'trim') {
          processedData = processedData.trim();
        }
      }
      reindexedItems[itemId] = processedData;
      count++;
    }

    await storage.put('index', index, {
      ...record,
      items: JSON.stringify(reindexedItems),
    });

    return { variant: 'ok', count };
  },
};
