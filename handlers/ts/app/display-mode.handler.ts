// @clef-handler style=functional
// DisplayMode Concept Implementation (v2)
// Named rendering configuration for entities of a given Schema.
// Each mode specifies how to display entities for a (schema, mode_id) pair.
// Strategy: Layout with FieldPlacements, ComponentMapping takeover, or flat field list.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

function compositeKey(schema: string, modeId: string): string {
  return `${schema}:${modeId}`;
}

const _handler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>): R {
    let p = createProgram();
    p = find(p, 'displayMode', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => ({
      items: JSON.stringify(bindings.all as unknown[]),
    })) as R;
  },

  create(input: Record<string, unknown>): R {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const name = input.name as string;

    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as R;
    }

    const key = compositeKey(schema, modeId);
    let p = createProgram();
    p = get(p, 'displayMode', key, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_exists', { schema, mode_id: modeId }),
      (b) => {
        let b2 = put(b, 'displayMode', key, {
          mode: key,
          name,
          mode_id: modeId,
          schema,
          layout: null,
          component_mapping: null,
          placements: '[]',
          role_visibility: null,
          cacheable: null,
        });
        return complete(b2, 'ok', { mode: key, output: { mode: key } });
      },
    ) as R;
  },

  resolve(input: Record<string, unknown>): R {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const key = compositeKey(schema, modeId);

    let p = createProgram();
    p = get(p, 'displayMode', key, 'record');
    return branch(p, 'record',
      (b) => complete(b, 'ok', { mode: key }),
      (b) => complete(b, 'not_found', { schema, mode_id: modeId }),
    ) as R;
  },

  set_layout(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const layout = input.layout as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          layout,
          component_mapping: null,
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  clear_layout(input: Record<string, unknown>): R {
    const mode = input.mode as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          layout: null,
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  set_component_mapping(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const mapping = input.mapping as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          component_mapping: mapping,
          layout: null,
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  clear_component_mapping(input: Record<string, unknown>): R {
    const mode = input.mode as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          component_mapping: null,
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  set_flat_fields(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const placements = input.placements as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          placements: typeof placements === 'string' ? placements : JSON.stringify(placements),
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  get(input: Record<string, unknown>): R {
    const mode = input.mode as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
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
        });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  delete(input: Record<string, unknown>): R {
    const mode = input.mode as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = del(b, 'displayMode', mode);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  list_for_schema(input: Record<string, unknown>): R {
    const schema = input.schema as string;

    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'error', { message: 'schema is required' }) as R;
    }

    let p = createProgram();
    p = find(p, 'displayMode', {}, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = bindings.all as Array<Record<string, unknown>>;
      const filtered = all.filter(m => m.schema === schema);
      return { modes: JSON.stringify(filtered) };
    }) as R;
  },

  configureFieldDisplay(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const field = input.field as string;
    const config = input.config as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          placements: JSON.stringify([{ field, config }]),
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => {
        let b2 = put(b, 'displayMode', mode, {
          mode,
          name: mode,
          mode_id: mode,
          schema: 'ContentNode',
          layout: null,
          component_mapping: null,
          placements: JSON.stringify([{ field, config }]),
          role_visibility: null,
          cacheable: null,
        });
        return complete(b2, 'ok', { mode });
      },
    ) as R;
  },

  renderInMode(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const entity = input.entity as string;

    return complete(createProgram(), 'ok', {
      output: JSON.stringify({ entity, mode, placements: [] }),
    }) as R;
  },

  set_role_visibility(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const roleVisibility = input.role_visibility as string | null;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'displayMode', mode, (bindings) => ({
          ...(bindings.record as Record<string, unknown>),
          role_visibility: roleVisibility ?? null,
        }));
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    ) as R;
  },

  defineMode(input: Record<string, unknown>): R {
    const mode = input.mode as string;
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'displayMode', mode, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'exists', { message: `A mode with name "${name}" already exists` }),
      (b) => {
        let b2 = put(b, 'displayMode', mode, {
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
        return complete(b2, 'ok', { mode });
      },
    ) as R;
  },
};

export const displayModeHandler = autoInterpret(_handler);
