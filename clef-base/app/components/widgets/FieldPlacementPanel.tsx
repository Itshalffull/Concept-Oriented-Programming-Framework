'use client';

/**
 * FieldPlacementPanel — Admin configuration panel for a single FieldPlacement.
 * Provides formatter picker, label options, visibility toggle, and field_mapping picker.
 */

import React, { useState, useCallback } from 'react';

const FORMATTERS = [
  'heading', 'plain_text', 'rich_text', 'badge', 'date_relative',
  'date_absolute', 'entity_reference', 'tag_list', 'image', 'json',
  'code', 'boolean_badge', 'number', 'url',
];

const LABEL_DISPLAYS = ['above', 'inline', 'hidden', 'visually_hidden'];

interface FieldPlacementPanelProps {
  placement: {
    placement: string;
    source_field: string;
    formatter: string;
    formatter_options: string | null;
    label_display: string;
    label_override: string | null;
    visible: boolean;
    role_visibility: string | null;
    field_mapping: string | null;
  };
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export const FieldPlacementPanel: React.FC<FieldPlacementPanelProps> = ({
  placement,
  onSave,
  onCancel,
}) => {
  const [formatter, setFormatter] = useState(placement.formatter);
  const [formatterOptions, setFormatterOptions] = useState(placement.formatter_options ?? '');
  const [labelDisplay, setLabelDisplay] = useState(placement.label_display);
  const [labelOverride, setLabelOverride] = useState(placement.label_override ?? '');
  const [visible, setVisible] = useState(placement.visible);
  const [fieldMapping, setFieldMapping] = useState(placement.field_mapping ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        placement: placement.placement,
        formatter,
        formatter_options: formatterOptions || null,
        label_display: labelDisplay,
        label_override: labelOverride || null,
        visible,
        field_mapping: fieldMapping || null,
      });
    } finally {
      setSaving(false);
    }
  }, [formatter, formatterOptions, labelDisplay, labelOverride, visible, fieldMapping, placement.placement, onSave]);

  return (
    <div data-surface="mag651-field-panel" data-layout="compact">
      <h3 data-part="field-panel-title">
        Field: {placement.source_field}
      </h3>

      <div data-part="field-panel-section">
        {/* Formatter */}
        <label data-part="field-label">
          <span>Formatter</span>
          <select value={formatter} onChange={e => setFormatter(e.target.value)} data-surface="mag651-field-control">
            {FORMATTERS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>

        {/* Formatter Options */}
        <label data-part="field-label">
          <span>Formatter Options (JSON)</span>
          <input
            type="text"
            value={formatterOptions}
            onChange={e => setFormatterOptions(e.target.value)}
            placeholder='e.g. {"level": 1}'
            data-surface="mag651-field-control"
          />
        </label>

        {/* Label Display */}
        <label data-part="field-label">
          <span>Label Display</span>
          <select value={labelDisplay} onChange={e => setLabelDisplay(e.target.value)} data-surface="mag651-field-control">
            {LABEL_DISPLAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        {/* Label Override */}
        <label data-part="field-label">
          <span>Label Override</span>
          <input
            type="text"
            value={labelOverride}
            onChange={e => setLabelOverride(e.target.value)}
            placeholder="Custom label (empty = use default)"
            data-surface="mag651-field-control"
          />
        </label>

        {/* Visibility */}
        <label data-surface="mag651-toggle">
          <input
            type="checkbox"
            checked={visible}
            onChange={e => setVisible(e.target.checked)}
          />
          <span>Visible</span>
        </label>

        {/* Field Mapping */}
        <label data-part="field-label">
          <span>ComponentMapping ID</span>
          <input
            type="text"
            value={fieldMapping}
            onChange={e => setFieldMapping(e.target.value)}
            placeholder="Optional — delegates to ComponentMapping"
            data-surface="mag651-field-control"
          />
        </label>
      </div>

      <div data-part="field-actions" style={{ marginTop: 'var(--spacing-md, 16px)' }}>
        <button data-part="button" data-variant="filled" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button data-part="button" data-variant="outlined" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default FieldPlacementPanel;
