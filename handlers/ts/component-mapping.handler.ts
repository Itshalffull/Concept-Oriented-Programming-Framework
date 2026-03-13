// ============================================================
// ComponentMapping Handler
//
// Admin-configured bindings between entity data and widget slots
// and props. Provides the manual override path for entity rendering
// when automatic WidgetResolver resolution is insufficient.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export function resetComponentMappingCounter(): void {
  idCounter = 0;
}

export const componentMappingHandler: ConceptHandler = {
  async list(_input: Record<string, unknown>, storage: ConceptStorage) {
    const mappings = await storage.find('mapping', {});

    // Enrich each mapping with slot/prop counts
    const allSlots = await storage.find('slot_binding', {});
    const allProps = await storage.find('prop_binding', {});

    const enriched = mappings.map((m: Record<string, unknown>) => {
      const slots = allSlots.filter((s: Record<string, unknown>) => s.mapping_id === m.id);
      const props = allProps.filter((p: Record<string, unknown>) => p.mapping_id === m.id);
      return {
        ...m,
        slot_count: slots.length,
        prop_count: props.length,
        slot_bindings: JSON.stringify(slots.map((s: Record<string, unknown>) => ({
          slot_name: s.slot_name,
          sources: s.sources,
        }))),
        prop_bindings: JSON.stringify(props.map((p: Record<string, unknown>) => ({
          prop_name: p.prop_name,
          source: p.source,
        }))),
      };
    });

    return { variant: 'ok', items: JSON.stringify(enriched) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const mappingId = input.mapping as string;
    const mapping = await storage.get('mapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping '${mappingId}' does not exist.` };
    }

    const allSlots = await storage.find('slot_binding', {});
    const allProps = await storage.find('prop_binding', {});
    const slots = allSlots.filter((s: Record<string, unknown>) => s.mapping_id === mappingId);
    const props = allProps.filter((p: Record<string, unknown>) => p.mapping_id === mappingId);

    return {
      variant: 'ok',
      mapping: mappingId,
      name: mapping.name as string,
      widget_id: mapping.widget_id as string,
      widget_variant: mapping.widget_variant as string | null,
      schema: mapping.schema as string | null,
      display_mode: mapping.display_mode as string | null,
      slot_bindings: JSON.stringify(slots.map((s: Record<string, unknown>) => ({
        slot_name: s.slot_name,
        sources: s.sources,
      }))),
      prop_bindings: JSON.stringify(props.map((p: Record<string, unknown>) => ({
        prop_name: p.prop_name,
        source: p.source,
      }))),
    };
  },

  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const widgetId = input.widget_id as string;
    const schema = input.schema as string;
    const displayMode = input.display_mode as string;

    if (!name || !widgetId) {
      return { variant: 'invalid', message: 'Name and widget_id are required.' };
    }

    // Check for existing mapping with same schema+display_mode
    const existing = await storage.find('mapping', {});
    for (const m of existing) {
      if (m.schema === schema && m.display_mode === displayMode) {
        return { variant: 'invalid', message: `A mapping already exists for ${schema}+${displayMode}.` };
      }
    }

    const id = nextId('mapping');
    await storage.put('mapping', id, {
      id,
      name,
      widget_id: widgetId,
      widget_variant: null,
      schema: schema || null,
      display_mode: displayMode || null,
    });

    return { variant: 'ok', mapping: id };
  },

  async bindSlot(input: Record<string, unknown>, storage: ConceptStorage) {
    const mappingId = input.mapping as string;
    const slotName = input.slot_name as string;
    const sources = input.sources as string[];

    const mapping = await storage.get('mapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping '${mappingId}' does not exist.` };
    }

    const slotId = nextId('slot');
    await storage.put('slot_binding', slotId, {
      id: slotId,
      mapping_id: mappingId,
      slot_name: slotName,
      sources: sources || [],
    });

    return { variant: 'ok' };
  },

  async bindProp(input: Record<string, unknown>, storage: ConceptStorage) {
    const mappingId = input.mapping as string;
    const propName = input.prop_name as string;
    const source = input.source as string;

    const mapping = await storage.get('mapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping '${mappingId}' does not exist.` };
    }

    const propId = nextId('prop');
    await storage.put('prop_binding', propId, {
      id: propId,
      mapping_id: mappingId,
      prop_name: propName,
      source: source || '',
    });

    return { variant: 'ok' };
  },

  async render(input: Record<string, unknown>, storage: ConceptStorage) {
    const mappingId = input.mapping as string;
    const context = input.context as string;

    const mapping = await storage.get('mapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping '${mappingId}' does not exist.` };
    }

    // Gather slot bindings
    const allSlots = await storage.find('slot_binding', {});
    const slots = allSlots.filter((s: Record<string, unknown>) => s.mapping_id === mappingId);

    // Gather prop bindings
    const allProps = await storage.find('prop_binding', {});
    const props = allProps.filter((p: Record<string, unknown>) => p.mapping_id === mappingId);

    const renderTree = JSON.stringify({
      widget_id: mapping.widget_id,
      widget_variant: mapping.widget_variant,
      context,
      slots: slots.map((s: Record<string, unknown>) => ({
        name: s.slot_name,
        sources: s.sources,
      })),
      props: props.map((p: Record<string, unknown>) => ({
        name: p.prop_name,
        source: p.source,
      })),
    });

    return { variant: 'ok', render_tree: renderTree };
  },

  async preview(input: Record<string, unknown>, storage: ConceptStorage) {
    const mappingId = input.mapping as string;
    const entityId = input.entity_id as string;

    const mapping = await storage.get('mapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping '${mappingId}' does not exist.` };
    }

    // Generate preview by rendering with entity context
    const renderResult = await componentMappingHandler.render(
      { mapping: mappingId, context: JSON.stringify({ entity_id: entityId }) },
      storage,
    );

    if (renderResult.variant !== 'ok') {
      return renderResult;
    }

    return { variant: 'ok', preview: renderResult.render_tree };
  },

  async lookup(input: Record<string, unknown>, storage: ConceptStorage) {
    const schema = input.schema as string;
    const displayMode = input.display_mode as string;

    const all = await storage.find('mapping', {});
    const found = all.find(
      (m: Record<string, unknown>) => m.schema === schema && m.display_mode === displayMode,
    );

    if (!found) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', mapping: found.id };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage) {
    const mappingId = input.mapping as string;

    const mapping = await storage.get('mapping', mappingId);
    if (!mapping) {
      return { variant: 'notfound', message: `Mapping '${mappingId}' does not exist.` };
    }

    // Delete all slot bindings for this mapping
    const allSlots = await storage.find('slot_binding', {});
    for (const slot of allSlots) {
      if ((slot as Record<string, unknown>).mapping_id === mappingId) {
        await storage.del('slot_binding', slot.id as string);
      }
    }

    // Delete all prop bindings for this mapping
    const allProps = await storage.find('prop_binding', {});
    for (const prop of allProps) {
      if ((prop as Record<string, unknown>).mapping_id === mappingId) {
        await storage.del('prop_binding', prop.id as string);
      }
    }

    // Delete the mapping itself
    await storage.del('mapping', mappingId);

    return { variant: 'ok' };
  },
};
