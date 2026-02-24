// FieldMapping Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const fieldMappingHandler: ConceptHandler = {
  async map(input, storage) {
    const mappingId = input.mappingId as string;
    const sourceField = input.sourceField as string;
    const destField = input.destField as string;
    const transform = input.transform as string || '';

    const mapping = await storage.get('fieldMapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping "${mappingId}" not found` };
    }

    const rules = (mapping.rules as any[]) || [];
    rules.push({ sourceField, destField, transform });

    await storage.put('fieldMapping', mappingId, {
      ...mapping,
      rules,
    });

    return { variant: 'ok' };
  },

  async apply(input, storage) {
    const record = input.record as string;
    const mappingId = input.mappingId as string;

    const mapping = await storage.get('fieldMapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping "${mappingId}" not found` };
    }

    // Plugin-dispatched to field_mapper provider for path resolution
    let sourceData: Record<string, unknown>;
    try {
      sourceData = JSON.parse(record);
    } catch {
      return { variant: 'error', message: 'Invalid JSON record' };
    }

    const rules = (mapping.rules as any[]) || [];
    const result: Record<string, unknown> = {};

    for (const rule of rules) {
      const value = sourceData[rule.sourceField];
      if (value !== undefined) {
        result[rule.destField] = value;
      } else if (rule.default !== undefined) {
        result[rule.destField] = rule.default;
      }
    }

    return { variant: 'ok', mapped: JSON.stringify(result) };
  },

  async reverse(input, storage) {
    const record = input.record as string;
    const mappingId = input.mappingId as string;

    const mapping = await storage.get('fieldMapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping "${mappingId}" not found` };
    }

    let destData: Record<string, unknown>;
    try {
      destData = JSON.parse(record);
    } catch {
      return { variant: 'notfound', message: 'Invalid JSON record' };
    }

    const rules = (mapping.rules as any[]) || [];
    const result: Record<string, unknown> = {};

    for (const rule of rules) {
      const value = destData[rule.destField];
      if (value !== undefined) {
        result[rule.sourceField] = value;
      }
    }

    return { variant: 'ok', reversed: JSON.stringify(result) };
  },

  async autoDiscover(input, storage) {
    const sourceSchema = input.sourceSchema as string;
    const destSchema = input.destSchema as string;

    const mappingId = `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let srcFields: string[];
    let dstFields: string[];
    try {
      srcFields = JSON.parse(sourceSchema);
      dstFields = JSON.parse(destSchema);
    } catch {
      srcFields = sourceSchema.split(',').map(f => f.trim());
      dstFields = destSchema.split(',').map(f => f.trim());
    }

    // Auto-discover by name similarity
    const suggestions: Array<{ src: string; dest: string }> = [];
    for (const src of srcFields) {
      const normalized = src.toLowerCase().replace(/[_-]/g, '');
      for (const dst of dstFields) {
        if (dst.toLowerCase().replace(/[_-]/g, '') === normalized) {
          suggestions.push({ src, dest: dst });
        }
      }
    }

    await storage.put('fieldMapping', mappingId, {
      mappingId,
      name: `${sourceSchema}→${destSchema}`,
      sourceSchema,
      destSchema,
      rules: suggestions.map(s => ({ sourceField: s.src, destField: s.dest, transform: '' })),
      unmapped: { source: [], dest: [] },
    });

    return { variant: 'ok', mappingId, suggestions: JSON.stringify(suggestions) };
  },

  async validate(input, storage) {
    const mappingId = input.mappingId as string;
    const mapping = await storage.get('fieldMapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping "${mappingId}" not found` };
    }

    const warnings: string[] = [];
    const rules = (mapping.rules as any[]) || [];

    if (rules.length === 0) {
      warnings.push('No mapping rules defined');
    }

    return { variant: 'ok', warnings: JSON.stringify(warnings) };
  },
};
