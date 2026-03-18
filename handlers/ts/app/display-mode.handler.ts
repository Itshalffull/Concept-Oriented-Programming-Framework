// @migrated dsl-constructs 2026-03-18
// DisplayMode Concept Implementation (v2)
// Named rendering configuration for entities of a given Schema.
// Each mode specifies how to display entities for a (schema, mode_id) pair.
// Strategy: Layout with FieldPlacements, ComponentMapping takeover, or flat field list.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

function compositeKey(schema: string, modeId: string): string {
  return `${schema}:${modeId}`;
}

const displayModeHandlerFunctional: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'displayMode', {}, 'items');
    return complete(p, 'ok', { items: '[]' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  create(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const name = input.name as string;
    const key = compositeKey(schema, modeId);

    let p = createProgram();
    p = spGet(p, 'displayMode', key, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'already_exists', { schema, mode_id: modeId }),
      (b) => {
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
        let b2 = put(b, 'displayMode', key, record);
        return complete(b2, 'ok', { mode: key });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const modeId = input.mode_id as string;
    const key = compositeKey(schema, modeId);

    let p = createProgram();
    p = spGet(p, 'displayMode', key, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', { mode: key }),
      (b) => complete(b, 'not_found', { schema, mode_id: modeId }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  set_layout(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const layout = input.layout as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'displayMode', mode, {
          layout,
          component_mapping: null,
        });
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'not_found', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clear_layout(input: Record<string, unknown>) {
    const mode = input.mode as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'displayMode', mode, { layout: null });
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'ok', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  set_component_mapping(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const mapping = input.mapping as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'displayMode', mode, {
          component_mapping: mapping,
          layout: null,
        });
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'ok', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clear_component_mapping(input: Record<string, unknown>) {
    const mode = input.mode as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'displayMode', mode, { component_mapping: null });
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'ok', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  set_flat_fields(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const placements = input.placements as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'displayMode', mode, {
          placements: typeof placements === 'string' ? placements : JSON.stringify(placements),
        });
        return complete(b2, 'ok', { mode });
      },
      (b) => complete(b, 'ok', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const mode = input.mode as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', {
        mode,
        name: '',
        mode_id: '',
        schema: '',
        layout: null,
        component_mapping: null,
        placements: '[]',
        role_visibility: null,
        cacheable: null,
      }),
      (b) => complete(b, 'not_found', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const mode = input.mode as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'displayMode', mode);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { mode }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list_for_schema(input: Record<string, unknown>) {
    const schema = input.schema as string;

    let p = createProgram();
    p = find(p, 'displayMode', {}, 'all');
    return complete(p, 'ok', { modes: '[]' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configureFieldDisplay(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const field = input.field as string;
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'displayMode', mode, {
          placements: JSON.stringify([{ field, config }]),
        });
        return complete(b2, 'ok', { mode });
      },
      (b) => {
        // Auto-create mode record when configuring field display directly
        const record = {
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
        let b2 = put(b, 'displayMode', mode, record);
        return complete(b2, 'ok', { mode });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  renderInMode(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'record');
    return complete(p, 'ok', { output: JSON.stringify({ entity, mode, placements: [] }) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  // Backward-compat shim: old seeds call defineMode
  defineMode(input: Record<string, unknown>) {
    const mode = input.mode as string;
    const name = input.name as string;

    let p = createProgram();
    p = spGet(p, 'displayMode', mode, 'existing');
    p = branch(p, 'existing',
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
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const displayModeHandler = wrapFunctional(displayModeHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { displayModeHandlerFunctional };
