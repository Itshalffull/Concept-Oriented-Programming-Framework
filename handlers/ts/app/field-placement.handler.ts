// FieldPlacement Concept Implementation
// One field's display configuration in one rendering context.
// Stores source field, formatter, label overrides, visibility, and optional
// ComponentMapping delegation for custom field-level rendering.
import type { ConceptHandler } from '@clef/runtime';

export const fieldPlacementHandler: ConceptHandler = {
  async list(_input, storage) {
    const items = await storage.find('fieldPlacement', {});
    return { variant: 'ok', items: JSON.stringify(items) };
  },

  async create(input, storage) {
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

    await storage.put('fieldPlacement', placement, record);
    return { variant: 'ok', placement };
  },

  async configure(input, storage) {
    const placement = input.placement as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'not_found', placement };
    }

    const updates: Record<string, unknown> = { ...record };
    if (input.formatter != null) updates.formatter = input.formatter;
    if (input.formatter_options != null) updates.formatter_options = input.formatter_options;
    if (input.label_display != null) updates.label_display = input.label_display;
    if (input.label_override != null) updates.label_override = input.label_override;

    await storage.put('fieldPlacement', placement, updates);
    return { variant: 'ok', placement };
  },

  async set_visibility(input, storage) {
    const placement = input.placement as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'ok', placement };
    }

    await storage.put('fieldPlacement', placement, {
      ...record,
      visible: input.visible ?? true,
      role_visibility: input.role_visibility ?? null,
    });

    return { variant: 'ok', placement };
  },

  async set_field_mapping(input, storage) {
    const placement = input.placement as string;
    const mapping = input.mapping as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'ok', placement };
    }

    await storage.put('fieldPlacement', placement, {
      ...record,
      field_mapping: mapping,
    });

    return { variant: 'ok', placement };
  },

  async clear_field_mapping(input, storage) {
    const placement = input.placement as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'ok', placement };
    }

    await storage.put('fieldPlacement', placement, {
      ...record,
      field_mapping: null,
    });

    return { variant: 'ok', placement };
  },

  async get(input, storage) {
    const placement = input.placement as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'not_found', placement };
    }

    return {
      variant: 'ok',
      placement,
      source_field: record.source_field as string,
      formatter: record.formatter as string,
      formatter_options: record.formatter_options as string | null,
      label_display: record.label_display as string,
      label_override: record.label_override as string | null,
      visible: record.visible as boolean,
      role_visibility: record.role_visibility as string | null,
      field_mapping: record.field_mapping as string | null,
    };
  },

  async delete(input, storage) {
    const placement = input.placement as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'ok' };
    }

    await storage.del('fieldPlacement', placement);
    return { variant: 'ok' };
  },

  async duplicate(input, storage) {
    const placement = input.placement as string;
    const record = await storage.get('fieldPlacement', placement);
    if (!record) {
      return { variant: 'ok', new_placement: placement };
    }

    const newPlacement = `${placement}-copy-${Date.now()}`;
    await storage.put('fieldPlacement', newPlacement, {
      ...record,
      placement: newPlacement,
    });

    return { variant: 'ok', new_placement: newPlacement };
  },
};
