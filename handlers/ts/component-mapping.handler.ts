// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ComponentMapping Handler
//
// Admin-configured bindings between entity data and widget slots
// and props. Provides the manual override path for entity rendering
// when automatic WidgetResolver resolution is insufficient.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export function resetComponentMappingCounter(): void {
  idCounter = 0;
}

const _handler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'mapping', {}, 'mappings');
    p = find(p, 'slot_binding', {}, 'allSlots');
    p = find(p, 'prop_binding', {}, 'allProps');

    return completeFrom(p, 'ok', (bindings) => {
      const mappings = bindings.mappings as Record<string, unknown>[];
      const allSlots = bindings.allSlots as Record<string, unknown>[];
      const allProps = bindings.allProps as Record<string, unknown>[];

      const enriched = mappings.map((m) => {
        const slots = allSlots.filter((s) => s.mapping_id === m.id);
        const props = allProps.filter((p) => p.mapping_id === m.id);
        return {
          ...m,
          slot_count: slots.length,
          prop_count: props.length,
          slot_bindings: JSON.stringify(slots.map((s) => ({
            slot_name: s.slot_name,
            sources: s.sources,
          }))),
          prop_bindings: JSON.stringify(props.map((p) => ({
            prop_name: p.prop_name,
            source: p.source,
          }))),
        };
      });

      return { items: JSON.stringify(enriched) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const mappingId = input.mapping as string;

    let p = createProgram();
    p = get(p, 'mapping', mappingId, 'mapping');

    return branch(p, 'mapping',
      (thenP) => {
        thenP = find(thenP, 'slot_binding', {}, 'allSlots');
        thenP = find(thenP, 'prop_binding', {}, 'allProps');

        return completeFrom(thenP, 'ok', (bindings) => {
          const mapping = bindings.mapping as Record<string, unknown>;
          const allSlots = bindings.allSlots as Record<string, unknown>[];
          const allProps = bindings.allProps as Record<string, unknown>[];
          const slots = allSlots.filter((s) => s.mapping_id === mappingId);
          const props = allProps.filter((p) => p.mapping_id === mappingId);

          return {
            mapping: mappingId,
            name: mapping.name as string,
            widget_id: mapping.widget_id as string,
            widget_variant: mapping.widget_variant as string | null,
            schema: mapping.schema as string | null,
            display_mode: mapping.display_mode as string | null,
            slot_bindings: JSON.stringify(slots.map((s) => ({
              slot_name: s.slot_name,
              sources: s.sources,
            }))),
            prop_bindings: JSON.stringify(props.map((p) => ({
              prop_name: p.prop_name,
              source: p.source,
            }))),
          };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Mapping '${mappingId}' does not exist.` }),
    ) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const widgetId = input.widget_id as string;
    const schema = input.schema as string;
    const displayMode = input.display_mode as string;

    if (!name || !widgetId) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Name and widget_id are required.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'mapping', {}, 'existing');

    return branch(p,
      (bindings) => {
        const existing = bindings.existing as Record<string, unknown>[];
        return existing.some(m => m.schema === schema && m.display_mode === displayMode);
      },
      (thenP) => complete(thenP, 'invalid', { message: `A mapping already exists for ${schema}+${displayMode}.` }),
      (elseP) => {
        const id = nextId('mapping');
        elseP = put(elseP, 'mapping', id, {
          id,
          name,
          widget_id: widgetId,
          widget_variant: null,
          schema: schema || null,
          display_mode: displayMode || null,
        });
        return complete(elseP, 'ok', { mapping: id });
      },
    ) as StorageProgram<Result>;
  },

  bindSlot(input: Record<string, unknown>) {
    const mappingId = input.mapping as string;
    const slotName = input.slot_name as string;
    const sources = input.sources as string[];

    let p = createProgram();
    p = get(p, 'mapping', mappingId, 'mapping');

    return branch(p, 'mapping',
      (thenP) => {
        const slotId = nextId('slot');
        thenP = put(thenP, 'slot_binding', slotId, {
          id: slotId,
          mapping_id: mappingId,
          slot_name: slotName,
          sources: sources || [],
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notfound', { message: `Mapping '${mappingId}' does not exist.` }),
    ) as StorageProgram<Result>;
  },

  bindProp(input: Record<string, unknown>) {
    const mappingId = input.mapping as string;
    const propName = input.prop_name as string;
    const source = input.source as string;

    let p = createProgram();
    p = get(p, 'mapping', mappingId, 'mapping');

    return branch(p, 'mapping',
      (thenP) => {
        const propId = nextId('prop');
        thenP = put(thenP, 'prop_binding', propId, {
          id: propId,
          mapping_id: mappingId,
          prop_name: propName,
          source: source || '',
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notfound', { message: `Mapping '${mappingId}' does not exist.` }),
    ) as StorageProgram<Result>;
  },

  render(input: Record<string, unknown>) {
    const mappingId = input.mapping as string;
    const context = input.context as string;

    let p = createProgram();
    p = get(p, 'mapping', mappingId, 'mapping');

    return branch(p, 'mapping',
      (thenP) => {
        thenP = find(thenP, 'slot_binding', {}, 'allSlots');
        thenP = find(thenP, 'prop_binding', {}, 'allProps');

        return completeFrom(thenP, 'ok', (bindings) => {
          const mapping = bindings.mapping as Record<string, unknown>;
          const allSlots = bindings.allSlots as Record<string, unknown>[];
          const allProps = bindings.allProps as Record<string, unknown>[];
          const slots = allSlots.filter((s) => s.mapping_id === mappingId);
          const props = allProps.filter((p) => p.mapping_id === mappingId);

          const renderTree = JSON.stringify({
            widget_id: mapping.widget_id,
            widget_variant: mapping.widget_variant,
            context,
            slots: slots.map((s) => ({ name: s.slot_name, sources: s.sources })),
            props: props.map((p) => ({ name: p.prop_name, source: p.source })),
          });

          return { render_tree: renderTree };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Mapping '${mappingId}' does not exist.` }),
    ) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const mappingId = input.mapping as string;
    const entityId = input.entity_id as string;

    let p = createProgram();
    p = get(p, 'mapping', mappingId, 'mapping');

    return branch(p, 'mapping',
      (thenP) => {
        thenP = find(thenP, 'slot_binding', {}, 'allSlots');
        thenP = find(thenP, 'prop_binding', {}, 'allProps');

        return completeFrom(thenP, 'ok', (bindings) => {
          const mapping = bindings.mapping as Record<string, unknown>;
          const allSlots = bindings.allSlots as Record<string, unknown>[];
          const allProps = bindings.allProps as Record<string, unknown>[];
          const slots = allSlots.filter((s) => s.mapping_id === mappingId);
          const props = allProps.filter((p) => p.mapping_id === mappingId);

          const renderTree = JSON.stringify({
            widget_id: mapping.widget_id,
            widget_variant: mapping.widget_variant,
            context: JSON.stringify({ entity_id: entityId }),
            slots: slots.map((s) => ({ name: s.slot_name, sources: s.sources })),
            props: props.map((p) => ({ name: p.prop_name, source: p.source })),
          });

          return { preview: renderTree };
        });
      },
      (elseP) => complete(elseP, 'notfound', { message: `Mapping '${mappingId}' does not exist.` }),
    ) as StorageProgram<Result>;
  },

  lookup(input: Record<string, unknown>) {
    const schema = input.schema as string;
    const displayMode = input.display_mode as string;

    let p = createProgram();
    p = find(p, 'mapping', {}, 'all');

    return branch(p,
      (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        return !all.find(m => m.schema === schema && m.display_mode === displayMode);
      },
      (thenP) => complete(thenP, 'notfound', {}),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const all = bindings.all as Record<string, unknown>[];
        const found = all.find(m => m.schema === schema && m.display_mode === displayMode);
        return { mapping: found!.id };
      }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const mappingId = input.mapping as string;

    let p = createProgram();
    p = get(p, 'mapping', mappingId, 'mapping');

    return branch(p, 'mapping',
      (thenP) => {
        // Delete mapping; slot/prop cleanup would require iterative deletes
        thenP = del(thenP, 'mapping', mappingId);
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'notfound', { message: `Mapping '${mappingId}' does not exist.` }),
    ) as StorageProgram<Result>;
  },
};

export const componentMappingHandler = autoInterpret(_handler);
