// DisplayMode Concept Implementation (v2)
// Named rendering configuration for entities of a given Schema.
// Each mode specifies how to display entities for a (schema, mode_id) pair.
// Strategy: Layout with FieldPlacements, ComponentMapping takeover, or flat field list.
import type { ConceptHandler } from '@clef/runtime';

function compositeKey(schema: string, modeId: string): string {
  return `${schema}:${modeId}`;
}

export const displayModeHandler: ConceptHandler = {
  async list(_input, storage) {
    const items = await storage.find('displayMode', {});
    return { variant: 'ok', items: JSON.stringify(items) };
  },

  async create(input, storage) {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const name = input.name as string;
    const key = compositeKey(schema, modeId);

    const existing = await storage.get('displayMode', key);
    if (existing) {
      return { variant: 'already_exists', schema, mode_id: modeId };
    }

    const record = {
      mode: key,
      name,
      mode_id: modeId,
      schema,
      layout: null,
      component_mapping: null,
      placements: '[]',
      role_visibility: null,
      cacheable: null,
    };

    await storage.put('displayMode', key, record);
    return { variant: 'ok', mode: key };
  },

  async resolve(input, storage) {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const key = compositeKey(schema, modeId);

    const record = await storage.get('displayMode', key);
    if (!record) {
      return { variant: 'not_found', schema, mode_id: modeId };
    }

    return { variant: 'ok', mode: key };
  },

  async set_layout(input, storage) {
    const mode = input.mode as string;
    const layout = input.layout as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    await storage.put('displayMode', mode, {
      ...record,
      layout,
      component_mapping: null,
    });

    return { variant: 'ok', mode };
  },

  async clear_layout(input, storage) {
    const mode = input.mode as string;
    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'ok', mode };
    }

    await storage.put('displayMode', mode, { ...record, layout: null });
    return { variant: 'ok', mode };
  },

  async set_component_mapping(input, storage) {
    const mode = input.mode as string;
    const mapping = input.mapping as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'ok', mode };
    }

    await storage.put('displayMode', mode, {
      ...record,
      component_mapping: mapping,
      layout: null,
    });

    return { variant: 'ok', mode };
  },

  async clear_component_mapping(input, storage) {
    const mode = input.mode as string;
    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'ok', mode };
    }

    await storage.put('displayMode', mode, { ...record, component_mapping: null });
    return { variant: 'ok', mode };
  },

  async set_flat_fields(input, storage) {
    const mode = input.mode as string;
    const placements = input.placements as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'ok', mode };
    }

    await storage.put('displayMode', mode, {
      ...record,
      placements: typeof placements === 'string' ? placements : JSON.stringify(placements),
    });

    return { variant: 'ok', mode };
  },

  async get(input, storage) {
    const mode = input.mode as string;
    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    return {
      variant: 'ok',
      mode,
      name: record.name as string,
      mode_id: record.mode_id as string,
      schema: record.schema as string,
      layout: record.layout as string | null,
      component_mapping: record.component_mapping as string | null,
      placements: record.placements as string,
      role_visibility: record.role_visibility as string | null,
      cacheable: record.cacheable as boolean | null,
    };
  },

  async delete(input, storage) {
    const mode = input.mode as string;
    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    await storage.del('displayMode', mode);
    return { variant: 'ok' };
  },

  async list_for_schema(input, storage) {
    const schema = input.schema as string;
    const all = await storage.find('displayMode', {});
    const matching = all.filter(
      (item: Record<string, unknown>) => item.schema === schema,
    );
    return { variant: 'ok', modes: JSON.stringify(matching) };
  },

  async configureFieldDisplay(input, storage) {
    const mode = input.mode as string;
    const field = input.field as string;
    const config = input.config as string;

    let record = await storage.get('displayMode', mode);
    if (!record) {
      // Auto-create mode record when configuring field display directly
      record = {
        mode,
        name: mode,
        mode_id: mode,
        schema: 'ContentNode',
        layout: null,
        component_mapping: null,
        placements: '[]',
        role_visibility: null,
        cacheable: null,
      };
    }

    const placements = record.placements
      ? (typeof record.placements === 'string' ? JSON.parse(record.placements as string) : record.placements) as Array<Record<string, unknown>>
      : [];
    const idx = placements.findIndex((p: Record<string, unknown>) => p.field === field);
    if (idx >= 0) {
      placements[idx] = { field, config };
    } else {
      placements.push({ field, config });
    }

    await storage.put('displayMode', mode, {
      ...record,
      placements: JSON.stringify(placements),
    });

    return { variant: 'ok', mode };
  },

  async renderInMode(input, storage) {
    const mode = input.mode as string;
    const entity = input.entity as string;

    const record = await storage.get('displayMode', mode);
    const placements = record?.placements
      ? (typeof record.placements === 'string' ? JSON.parse(record.placements as string) : record.placements) as Array<Record<string, unknown>>
      : [];

    const output = JSON.stringify({ entity, mode, placements });
    return { variant: 'ok', output };
  },

  // Backward-compat shim: old seeds call defineMode
  async defineMode(input, storage) {
    const mode = input.mode as string;
    const name = input.name as string;

    const existing = await storage.get('displayMode', mode);
    if (existing) {
      return { variant: 'exists', message: `A mode with name "${name}" already exists` };
    }

    await storage.put('displayMode', mode, {
      mode,
      name,
      mode_id: mode,
      schema: 'ContentNode',
      layout: null,
      component_mapping: null,
      placements: '[]',
      role_visibility: null,
      cacheable: null,
    });

    return { variant: 'ok', mode };
  },
};
