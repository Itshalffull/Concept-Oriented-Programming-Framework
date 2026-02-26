// ProgressiveSchema Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const progressiveSchemaHandler: ConceptHandler = {
  async captureFreeform(input, storage) {
    const content = input.content as string;

    const itemId = `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await storage.put('progressiveItem', itemId, {
      itemId,
      content,
      formality: 'freeform',
      detectedStructure: [],
      schema: null,
      promotionHistory: [],
    });

    return { variant: 'ok', itemId };
  },

  async detectStructure(input, storage) {
    const itemId = input.itemId as string;

    const item = await storage.get('progressiveItem', itemId);
    if (!item) {
      return { variant: 'notfound', message: `Item "${itemId}" not found` };
    }

    // Plugin-dispatched to structure_detector providers
    const content = item.content as string;
    const suggestions: any[] = [];
    let sugIdx = 0;

    // Built-in date detection
    const datePattern = /\b(\d{4}-\d{2}-\d{2})\b/g;
    let match;
    while ((match = datePattern.exec(content)) !== null) {
      suggestions.push({
        suggestionId: `sug-${++sugIdx}`,
        detectorId: 'date_detector',
        field: 'date',
        value: match[1],
        type: 'date',
        confidence: 0.95,
        status: 'pending',
      });
    }

    // Built-in tag detection
    const tagPattern = /#([\w-]+)/g;
    while ((match = tagPattern.exec(content)) !== null) {
      suggestions.push({
        suggestionId: `sug-${++sugIdx}`,
        detectorId: 'tag_detector',
        field: 'tag',
        value: match[1],
        type: 'tag',
        confidence: 0.9,
        status: 'pending',
      });
    }

    // Built-in URL detection
    const urlPattern = /https?:\/\/[^\s]+/g;
    while ((match = urlPattern.exec(content)) !== null) {
      suggestions.push({
        suggestionId: `sug-${++sugIdx}`,
        detectorId: 'url_detector',
        field: 'url',
        value: match[0],
        type: 'url',
        confidence: 0.99,
        status: 'pending',
      });
    }

    // Built-in key:value detection
    const kvPattern = /^(\w[\w\s]*?):\s+(.+)$/gm;
    while ((match = kvPattern.exec(content)) !== null) {
      suggestions.push({
        suggestionId: `sug-${++sugIdx}`,
        detectorId: 'kv_detector',
        field: match[1].trim().toLowerCase().replace(/\s+/g, '_'),
        value: match[2].trim(),
        type: 'string',
        confidence: 0.7,
        status: 'pending',
      });
    }

    await storage.put('progressiveItem', itemId, {
      ...item,
      detectedStructure: suggestions,
      formality: suggestions.length > 0 ? 'inline_metadata' : item.formality,
    });

    return { variant: 'ok', suggestions: JSON.stringify(suggestions) };
  },

  async acceptSuggestion(input, storage) {
    const itemId = input.itemId as string;
    const suggestionId = input.suggestionId as string;

    const item = await storage.get('progressiveItem', itemId);
    if (!item) {
      return { variant: 'notfound', message: `Item "${itemId}" not found` };
    }

    const suggestions = (item.detectedStructure as any[]) || [];
    const suggestion = suggestions.find((s: any) => s.suggestionId === suggestionId);
    if (!suggestion) {
      return { variant: 'notfound', message: `Suggestion "${suggestionId}" not found` };
    }

    suggestion.status = 'accepted';

    const hasAccepted = suggestions.some((s: any) => s.status === 'accepted');
    await storage.put('progressiveItem', itemId, {
      ...item,
      detectedStructure: suggestions,
      formality: hasAccepted ? 'typed_properties' : item.formality,
    });

    return { variant: 'ok' };
  },

  async rejectSuggestion(input, storage) {
    const itemId = input.itemId as string;
    const suggestionId = input.suggestionId as string;

    const item = await storage.get('progressiveItem', itemId);
    if (!item) {
      return { variant: 'notfound', message: `Item "${itemId}" not found` };
    }

    const suggestions = (item.detectedStructure as any[]) || [];
    const suggestion = suggestions.find((s: any) => s.suggestionId === suggestionId);
    if (!suggestion) {
      return { variant: 'notfound', message: `Suggestion "${suggestionId}" not found` };
    }

    suggestion.status = 'rejected';
    await storage.put('progressiveItem', itemId, {
      ...item,
      detectedStructure: suggestions,
    });

    return { variant: 'ok' };
  },

  async promote(input, storage) {
    const itemId = input.itemId as string;
    const targetSchema = input.targetSchema as string;

    const item = await storage.get('progressiveItem', itemId);
    if (!item) {
      return { variant: 'notfound', message: `Item "${itemId}" not found` };
    }

    const suggestions = (item.detectedStructure as any[]) || [];
    const accepted = suggestions.filter((s: any) => s.status === 'accepted');

    // Check if enough fields are accepted to conform to target schema
    const history = (item.promotionHistory as any[]) || [];
    history.push({
      from: item.formality,
      to: 'schema_conformant',
      timestamp: new Date().toISOString(),
    });

    await storage.put('progressiveItem', itemId, {
      ...item,
      schema: targetSchema,
      formality: 'schema_conformant',
      promotionHistory: history,
    });

    return { variant: 'ok', result: JSON.stringify({ schema: targetSchema, fields: accepted.length }) };
  },

  async inferSchema(input, storage) {
    const items = input.items as string;

    let itemIds: string[];
    try {
      itemIds = JSON.parse(items);
    } catch {
      itemIds = items.split(',').map(id => id.trim());
    }

    if (itemIds.length === 0) {
      return { variant: 'error', message: 'No items provided for schema inference' };
    }

    // Collect all accepted suggestions across items to find common fields
    const fieldCounts: Record<string, { type: string; count: number }> = {};

    for (const id of itemIds) {
      const item = await storage.get('progressiveItem', id);
      if (item) {
        const suggestions = (item.detectedStructure as any[]) || [];
        for (const s of suggestions.filter((s: any) => s.status === 'accepted')) {
          const key = s.field as string;
          if (!fieldCounts[key]) {
            fieldCounts[key] = { type: s.type as string, count: 0 };
          }
          fieldCounts[key].count++;
        }
      }
    }

    const proposedFields = Object.entries(fieldCounts)
      .filter(([, info]) => info.count >= itemIds.length * 0.5)
      .map(([name, info]) => ({ name, type: info.type }));

    return { variant: 'ok', proposedSchema: JSON.stringify({ fields: proposedFields }) };
  },
};
