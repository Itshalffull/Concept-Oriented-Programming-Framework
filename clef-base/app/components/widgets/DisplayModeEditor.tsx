'use client';

/**
 * DisplayModeEditor — editor for per-display-mode formatter assignment.
 *
 * Shows a grid:
 *   Rows:    field names (from FieldDefinition.list for the schema)
 *   Columns: display modes registered for this schema (from DisplayMode.list)
 *   Cells:   dropdown to pick the formatter for (field, mode)
 *
 * A live mini-preview sample row is shown below the grid.
 *
 * Changes are persisted via FieldPlacement.set (or DisplayMode.set_flat_fields).
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { useConceptQuery } from '../../../lib/use-concept-query';
import { FIELD_TYPE_REGISTRY } from './FieldWidget';
import { Badge } from './Badge';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface DisplayModeEditorProps {
  schemaId: string;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FieldRow {
  id: string;
  label: string;
  type: string;
  required?: boolean;
}

interface DisplayModeRow {
  mode_id: string;
  name: string;
}

/** A map of fieldId -> modeId -> formatter string */
type FormatterGrid = Record<string, Record<string, string>>;

// ─── Formatter options ─────────────────────────────────────────────────────────

const FORMATTERS: Array<{ value: string; label: string }> = [
  { value: 'plain_text',       label: 'Plain text' },
  { value: 'heading',          label: 'Heading' },
  { value: 'badge',            label: 'Badge' },
  { value: 'boolean_badge',    label: 'Boolean badge' },
  { value: 'date_relative',    label: 'Date (relative)' },
  { value: 'date_absolute',    label: 'Date (absolute)' },
  { value: 'tag_list',         label: 'Tag list' },
  { value: 'entity_reference', label: 'Entity ref' },
  { value: 'rich_text',        label: 'Rich text' },
  { value: 'code',             label: 'Code' },
  { value: 'truncate',         label: 'Truncate' },
  { value: 'image',            label: 'Image' },
  { value: 'json',             label: 'JSON' },
  { value: 'json_count',       label: 'JSON count' },
  { value: 'hidden',           label: '— Hidden —' },
];

/** Derive a reasonable default formatter from a field type. */
function defaultFormatterForType(type: string): string {
  switch (type) {
    case 'boolean':     return 'boolean_badge';
    case 'date':
    case 'datetime':    return 'date_relative';
    case 'rich-text':   return 'rich_text';
    case 'media':
    case 'url':         return 'image';
    case 'json':        return 'json';
    case 'select':
    case 'multi-select':
    case 'person':
    case 'relation':    return 'badge';
    default:            return 'plain_text';
  }
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'var(--palette-surface)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  borderBottom: '1px solid var(--palette-outline)',
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-md-size)',
  fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
  color: 'var(--palette-on-surface)',
};

const scrollWrapStyle: React.CSSProperties = {
  flex: 1,
  overflowX: 'auto',
  overflowY: 'auto',
};

const tableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  fontSize: 'var(--typography-body-sm-size)',
};

const thFieldStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--palette-surface-variant)',
  borderBottom: '2px solid var(--palette-outline)',
  borderRight: '1px solid var(--palette-outline)',
  padding: '6px 10px',
  textAlign: 'left',
  fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
  color: 'var(--palette-on-surface-variant)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  minWidth: 140,
  zIndex: 2,
};

const thModeStyle: React.CSSProperties = {
  background: 'var(--palette-surface-variant)',
  borderBottom: '2px solid var(--palette-outline)',
  borderRight: '1px solid var(--palette-outline-variant)',
  padding: '6px 8px',
  textAlign: 'center',
  fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
  color: 'var(--palette-on-surface-variant)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  minWidth: 140,
};

const tdFieldStyle: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--palette-surface)',
  borderBottom: '1px solid var(--palette-outline-variant)',
  borderRight: '1px solid var(--palette-outline)',
  padding: '6px 10px',
  zIndex: 1,
};

const tdCellStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--palette-outline-variant)',
  borderRight: '1px solid var(--palette-outline-variant)',
  padding: '4px 6px',
  verticalAlign: 'middle',
};

const fieldNameStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  fontSize: 'var(--typography-body-sm-size)',
  color: 'var(--palette-on-surface)',
  whiteSpace: 'nowrap',
};

const typeIconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  borderRadius: '3px',
  background: 'var(--palette-primary-container)',
  color: 'var(--palette-on-primary-container)',
  fontSize: '9px',
  fontWeight: 'bold',
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '3px 6px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: '12px',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const previewSectionStyle: React.CSSProperties = {
  borderTop: '1px solid var(--palette-outline)',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  flexShrink: 0,
  background: 'var(--palette-surface-variant)',
};

const previewLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 'bold',
  color: 'var(--palette-on-surface-variant)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 'var(--spacing-xs)',
};

const previewRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--spacing-sm)',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const emptyStyle: React.CSSProperties = {
  padding: 'var(--spacing-lg) var(--spacing-md)',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 'var(--typography-body-sm-size)',
  textAlign: 'center',
};

// ─── PreviewCell — renders a sample value using the formatter ──────────────────

function renderSampleValue(formatter: string, fieldType: string): React.ReactNode {
  switch (formatter) {
    case 'heading':          return <strong>Sample heading</strong>;
    case 'badge':            return <Badge variant="secondary">sample</Badge>;
    case 'boolean_badge':    return <Badge variant="success">yes</Badge>;
    case 'date_relative':    return <span>3d ago</span>;
    case 'date_absolute':    return <span>Apr 10, 2026</span>;
    case 'tag_list':         return (
      <span style={{ display: 'flex', gap: 4 }}>
        <Badge variant="secondary">alpha</Badge>
        <Badge variant="secondary">beta</Badge>
      </span>
    );
    case 'entity_reference': return <Badge variant="info">entity-123</Badge>;
    case 'rich_text':        return <div dangerouslySetInnerHTML={{ __html: '<em>Rich</em> text' }} />;
    case 'code':             return <code style={{ fontSize: 11 }}>console.log()</code>;
    case 'truncate':         return <span title="Sample long text value">Sample long text...</span>;
    case 'image':            return <span style={{ opacity: 0.5 }}>[image]</span>;
    case 'json':             return <code style={{ fontSize: 11 }}>{'{"key":"val"}'}</code>;
    case 'json_count':       return <span>3 items</span>;
    case 'hidden':           return <span style={{ opacity: 0.3, fontSize: 10 }}>hidden</span>;
    default:                 return <span>Sample value</span>;
  }
}

// ─── FormatterSelect ───────────────────────────────────────────────────────────

const FormatterSelect: React.FC<{
  fieldId: string;
  modeId: string;
  value: string;
  fieldType: string;
  onChange: (fieldId: string, modeId: string, formatter: string) => void;
}> = ({ fieldId, modeId, value, fieldType, onChange }) => {
  const defaultFormatter = defaultFormatterForType(fieldType);
  const effectiveValue = value || defaultFormatter;

  return (
    <select
      data-part="formatter-select"
      style={selectStyle}
      value={effectiveValue}
      onChange={(e) => onChange(fieldId, modeId, e.target.value)}
      aria-label={`Formatter for field in ${modeId} mode`}
    >
      {FORMATTERS.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
};

// ─── DisplayModeEditor ─────────────────────────────────────────────────────────

export const DisplayModeEditor: React.FC<DisplayModeEditorProps> = ({ schemaId }) => {
  const invoke = useKernelInvoke();

  // Load fields
  const { data: rawFields, loading: fieldsLoading } = useConceptQuery<FieldRow[]>(
    'FieldDefinition', 'list', { schema: schemaId },
  );

  // Load display modes for this schema
  const { data: rawModes, loading: modesLoading } = useConceptQuery<DisplayModeRow[]>(
    'DisplayMode', 'list', { schema: schemaId },
  );

  const fields = useMemo<FieldRow[]>(() => {
    if (!rawFields) return [];
    return Array.isArray(rawFields) ? rawFields : [];
  }, [rawFields]);

  const modes = useMemo<DisplayModeRow[]>(() => {
    if (!rawModes) return [];
    return Array.isArray(rawModes) ? rawModes : [];
  }, [rawModes]);

  // Grid state: fieldId -> modeId -> formatter
  const [grid, setGrid] = useState<FormatterGrid>({});
  const [previewModeId, setPreviewModeId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Initialise grid from existing FieldPlacement data
  useEffect(() => {
    if (!fields.length || !modes.length) return;

    const initialGrid: FormatterGrid = {};
    for (const field of fields) {
      initialGrid[field.id] = {};
      for (const mode of modes) {
        initialGrid[field.id][mode.mode_id] = defaultFormatterForType(field.type);
      }
    }
    setGrid(initialGrid);

    if (modes.length > 0 && !previewModeId) {
      setPreviewModeId(modes[0].mode_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length, modes.length]);

  const handleFormatterChange = useCallback(
    (fieldId: string, modeId: string, formatter: string) => {
      setGrid((prev) => ({
        ...prev,
        [fieldId]: {
          ...(prev[fieldId] ?? {}),
          [modeId]: formatter,
        },
      }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Persist each (field, mode) formatter via FieldPlacement
      const promises: Promise<unknown>[] = [];
      for (const field of fields) {
        for (const mode of modes) {
          const formatter = grid[field.id]?.[mode.mode_id] ?? defaultFormatterForType(field.type);
          promises.push(
            invoke('FieldPlacement', 'set', {
              schema: schemaId,
              mode_id: mode.mode_id,
              source_field: field.id,
              formatter,
              visible: formatter !== 'hidden',
              label_display: 'above',
            }),
          );
        }
      }
      await Promise.all(promises);
    } finally {
      setSaving(false);
    }
  }, [fields, modes, grid, invoke, schemaId]);

  const loading = fieldsLoading || modesLoading;

  if (loading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
          Loading display modes...
        </div>
      </div>
    );
  }

  if (!fields.length) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          No fields defined for this schema. Add fields first.
        </div>
      </div>
    );
  }

  if (!modes.length) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          No display modes registered for schema &quot;{schemaId}&quot;.
          Display modes are registered via DisplayMode.create.
        </div>
      </div>
    );
  }

  // Preview row — show sample values for the selected mode
  const previewMode = modes.find((m) => m.mode_id === previewModeId) ?? modes[0];
  const previewFields = fields.filter(
    (f) => (grid[f.id]?.[previewMode.mode_id] ?? '') !== 'hidden',
  );

  return (
    <div data-part="root" style={containerStyle}>
      {/* Header */}
      <div data-part="header" style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={headerTitleStyle}>Display Mode Formatters</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
              Preview:
            </span>
            <select
              data-part="preview-mode-picker"
              value={previewModeId}
              onChange={(e) => setPreviewModeId(e.target.value)}
              style={{ ...selectStyle, width: 'auto', minWidth: 120 }}
              aria-label="Select mode to preview"
            >
              {modes.map((m) => (
                <option key={m.mode_id} value={m.mode_id}>{m.name}</option>
              ))}
            </select>
            <button
              type="button"
              data-part="save-button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '4px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--palette-primary)',
                color: 'var(--palette-on-primary)',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 'var(--typography-body-sm-size)',
                fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Formatter grid */}
      <div data-part="grid-scroll" style={scrollWrapStyle}>
        <table data-part="formatter-grid" style={tableStyle} aria-label="Field formatters by display mode">
          <thead>
            <tr>
              <th style={thFieldStyle} scope="col">Field</th>
              {modes.map((mode) => (
                <th key={mode.mode_id} style={thModeStyle} scope="col">
                  {mode.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const typeCfg = FIELD_TYPE_REGISTRY[field.type];
              return (
                <tr key={field.id} data-part="field-row">
                  <td style={tdFieldStyle}>
                    <div style={fieldNameStyle}>
                      <span style={typeIconStyle} title={typeCfg?.label ?? field.type}>
                        {typeCfg?.icon ?? field.type.charAt(0).toUpperCase()}
                      </span>
                      <span>{field.label}</span>
                      {field.required && (
                        <span style={{
                          fontSize: '9px',
                          color: 'var(--palette-primary)',
                          fontWeight: 'bold',
                        }}>*</span>
                      )}
                    </div>
                  </td>
                  {modes.map((mode) => (
                    <td key={mode.mode_id} data-part="formatter-cell" style={tdCellStyle}>
                      <FormatterSelect
                        fieldId={field.id}
                        modeId={mode.mode_id}
                        value={grid[field.id]?.[mode.mode_id] ?? ''}
                        fieldType={field.type}
                        onChange={handleFormatterChange}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Live mini-preview */}
      <div data-part="preview-section" style={previewSectionStyle}>
        <div style={previewLabelStyle}>
          Sample row — {previewMode.name}
        </div>
        <div data-part="preview-row" style={previewRowStyle}>
          {previewFields.length === 0 ? (
            <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)', opacity: 0.6 }}>
              All fields hidden
            </span>
          ) : (
            previewFields.map((field) => {
              const formatter = grid[field.id]?.[previewMode.mode_id] ?? defaultFormatterForType(field.type);
              return (
                <div
                  key={field.id}
                  data-part="preview-cell"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    fontSize: 'var(--typography-body-sm-size)',
                  }}
                >
                  <span style={{
                    fontSize: '10px',
                    color: 'var(--palette-on-surface-variant)',
                    opacity: 0.6,
                  }}>
                    {field.label}
                  </span>
                  <span>
                    {renderSampleValue(formatter, field.type)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DisplayModeEditor;
