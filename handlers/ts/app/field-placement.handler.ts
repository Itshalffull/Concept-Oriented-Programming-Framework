// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// FieldPlacement Concept Implementation
// One field's display configuration in one rendering context.
// Stores source field, formatter, label overrides, visibility, and optional
// ComponentMapping delegation for custom field-level rendering.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  completeFrom, mapBindings, mergeFrom, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _fieldPlacementHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'fieldPlacement', {}, 'items');
    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      return { items: JSON.stringify(items || []) };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  create(input: Record<string, unknown>) {
    if (!input.source_field || (typeof input.source_field === 'string' && (input.source_field as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'source_field is required' }) as StorageProgram<Result>;
    }
    const sourceField = input.source_field as string;
    const formatter = input.formatter as string;
    const placement = input.placement as string ?? `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const record = {
      placement,
      source_field: sourceField,
      formatter,
      formatter_options: null,
      label_display: 'above',
      label_override: null,
      visible: true,
      role_visibility: null,
      field_mapping: null,
    };

    let p = createProgram();
    p = put(p, 'fieldPlacement', placement, record);
    return complete(p, 'ok', { placement }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configure(input: Record<string, unknown>) {
    const placement = input.placement as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'fieldPlacement', placement, (bindings) => {
          const updates: Record<string, unknown> = {};
          if (input.formatter !== undefined) updates.formatter = input.formatter;
          if (input.formatter_options !== undefined) updates.formatter_options = input.formatter_options;
          if (input.label_display !== undefined) updates.label_display = input.label_display;
          if (input.label_override !== undefined) updates.label_override = input.label_override;
          if (input.visible !== undefined) updates.visible = input.visible;
          if (input.role_visibility !== undefined) updates.role_visibility = input.role_visibility;
          if (input.field_mapping !== undefined) updates.field_mapping = input.field_mapping;
          return updates;
        });
        return complete(b2, 'ok', { placement });
      },
      (b) => complete(b, 'not_found', { placement }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  set_visibility(input: Record<string, unknown>) {
    const placement = input.placement as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'fieldPlacement', placement, () => ({
          visible: input.visible ?? true,
          role_visibility: input.role_visibility ?? null,
        }));
        return complete(b2, 'ok', { placement });
      },
      (b) => complete(b, 'ok', { placement }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  set_field_mapping(input: Record<string, unknown>) {
    if (!input.mapping || (typeof input.mapping === 'string' && (input.mapping as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'mapping is required' }) as StorageProgram<Result>;
    }
    const placement = input.placement as string;
    const mapping = input.mapping as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'fieldPlacement', placement, () => ({ field_mapping: mapping }));
        return complete(b2, 'ok', { placement });
      },
      (b) => complete(b, 'ok', { placement }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clear_field_mapping(input: Record<string, unknown>) {
    const placement = input.placement as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'fieldPlacement', placement, () => ({ field_mapping: null }));
        return complete(b2, 'ok', { placement });
      },
      (b) => complete(b, 'ok', { placement }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const placement = input.placement as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          placement,
          source_field: rec.source_field ?? '',
          formatter: rec.formatter ?? '',
          formatter_options: rec.formatter_options ?? null,
          label_display: rec.label_display ?? '',
          label_override: rec.label_override ?? null,
          visible: rec.visible ?? true,
          role_visibility: rec.role_visibility ?? null,
          field_mapping: rec.field_mapping ?? null,
        };
      }),
      (b) => complete(b, 'not_found', { placement }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  delete(input: Record<string, unknown>) {
    const placement = input.placement as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'fieldPlacement', placement);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'ok', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  duplicate(input: Record<string, unknown>) {
    const placement = input.placement as string;

    let p = createProgram();
    p = spGet(p, 'fieldPlacement', placement, 'record');
    const newPlacement = `${placement}-copy-${Date.now()}`;
    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'fieldPlacement', newPlacement, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return { ...rec, placement: newPlacement };
        });
        return complete(b2, 'ok', { new_placement: newPlacement });
      },
      (b) => complete(b, 'ok', { new_placement: placement }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const fieldPlacementHandler = autoInterpret(_fieldPlacementHandler);
