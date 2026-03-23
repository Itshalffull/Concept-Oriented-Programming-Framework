// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// DisplayMode Concept Implementation (v2)
// Named rendering configuration for entities of a given Schema.
// Each mode specifies how to display entities for a (schema, mode_id) pair.
// Strategy: Layout with FieldPlacements, ComponentMapping takeover, or flat field list.
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

function compositeKey(schema: string, modeId: string): string {
  return `${schema}:${modeId}`;
}

export const displayModeHandler: ConceptHandler = {
  async list(_input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const all = await storage.find('displayMode', {}) as Record<string, unknown>[];
    return { variant: 'ok', items: JSON.stringify(all) };
  },

  async create(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const name = input.name as string;

    if (!schema || schema.trim() === '') {
      return { variant: 'error', message: 'schema is required' };
    }

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
    return { variant: 'ok', mode: key, output: { mode: key } };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const key = compositeKey(schema, modeId);

    const record = await storage.get('displayMode', key);
    if (record) {
      return { variant: 'ok', mode: key };
    }
    return { variant: 'not_found', schema, mode_id: modeId };
  },

  async set_layout(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
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

  async clear_layout(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }
    await storage.put('displayMode', mode, { ...record, layout: null });
    return { variant: 'ok', mode };
  },

  async set_component_mapping(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;
    const mapping = input.mapping as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    await storage.put('displayMode', mode, {
      ...record,
      component_mapping: mapping,
      layout: null,
    });
    return { variant: 'ok', mode };
  },

  async clear_component_mapping(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }
    await storage.put('displayMode', mode, { ...record, component_mapping: null });
    return { variant: 'ok', mode };
  },

  async set_flat_fields(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;
    const placements = input.placements as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    await storage.put('displayMode', mode, {
      ...record,
      placements: typeof placements === 'string' ? placements : JSON.stringify(placements),
    });
    return { variant: 'ok', mode };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    return {
      variant: 'ok',
      mode,
      name: record.name ?? '',
      mode_id: record.mode_id ?? '',
      schema: record.schema ?? '',
      layout: record.layout ?? null,
      component_mapping: record.component_mapping ?? null,
      placements: record.placements ?? '[]',
      role_visibility: record.role_visibility ?? null,
      cacheable: record.cacheable ?? null,
    };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;

    const record = await storage.get('displayMode', mode);
    if (!record) {
      return { variant: 'not_found', mode };
    }

    await storage.del('displayMode', mode);
    return { variant: 'ok' };
  },

  async list_for_schema(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const schema = input.schema as string;

    if (!schema || schema.trim() === '') {
      return { variant: 'error', message: 'schema is required' };
    }

    const all = await storage.find('displayMode', {}) as Record<string, unknown>[];
    const filtered = all.filter(m => m.schema === schema);
    return { variant: 'ok', modes: JSON.stringify(filtered) };
  },

  async configureFieldDisplay(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;
    const field = input.field as string;
    const config = input.config as string;

    const record = await storage.get('displayMode', mode);
    if (record) {
      await storage.put('displayMode', mode, {
        ...record,
        placements: JSON.stringify([{ field, config }]),
      });
    } else {
      const newRecord = {
        mode,
        name: mode,
        mode_id: mode,
        schema: 'ContentNode',
        layout: null,
        component_mapping: null,
        placements: JSON.stringify([{ field, config }]),
        role_visibility: null,
        cacheable: null,
      };
      await storage.put('displayMode', mode, newRecord);
    }
    return { variant: 'ok', mode };
  },

  async renderInMode(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const mode = input.mode as string;
    const entity = input.entity as string;

    return { variant: 'ok', output: JSON.stringify({ entity, mode, placements: [] }) };
  },

  async defineMode(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
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
