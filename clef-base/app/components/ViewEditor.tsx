'use client';

/**
 * ViewEditor — Full view builder/editor (form mode of a View config entity).
 *
 * Per frontend spec §6.4 and §3.2, the view builder is the form mode of a
 * View config entity. It composes multiple editor panels:
 *
 * 1. Source selector — concept + action + params
 * 2. Style selector — layout type tabs
 * 3. Field configurator — sortable fields with visibility, formatter, label
 * 4. Filter configurator — add/remove filters with exposed toggle
 * 5. Sort/group configurator — grouping field, sort fields
 * 6. Controls configurator — create button, row click navigation
 * 7. Live preview — actual ViewRenderer showing real-time result
 *
 * Each panel is a Card widget. The editor uses the Surface widget system:
 * FieldWidget for inputs, Badge for status indicators, Card for containers.
 * Theme-aware via CSS custom properties throughout.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card } from './widgets/Card';
import { Badge } from './widgets/Badge';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';
import { ViewRenderer } from './ViewRenderer';
import { ViewEditorToolbar } from './widgets/ViewEditorToolbar';

// ── Types ────────────────────────────────────────────────────────────────────

interface ViewConfig {
  view: string;
  dataSource: string;
  layout: string;
  filters: string;
  sorts: string;
  groups: string;
  visibleFields: string;
  formatting: string;
  controls: string;
  title: string;
  description: string;
}

interface DataSourceConfig {
  concept: string;
  action: string;
  params?: Record<string, unknown>;
}

interface FieldConfig {
  key: string;
  label?: string;
  formatter?: string;
  visible?: boolean;
  weight?: number;
}

interface FilterConfig {
  field: string;
  label?: string;
  type: 'toggle-group';
  defaultOn?: string[];
  defaultOff?: string[];
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

interface ControlsConfig {
  create?: {
    concept: string;
    action: string;
    fields: Array<{
      name: string;
      label?: string;
      type?: string;
      options?: string[];
      required?: boolean;
      placeholder?: string;
    }>;
  };
  rowClick?: {
    navigateTo: string;
  };
}

interface ViewEditorProps {
  viewId: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS = [
  { value: 'table', label: 'Table', icon: '▦' },
  { value: 'card-grid', label: 'Card Grid', icon: '▧' },
  { value: 'list', label: 'List', icon: '≡' },
  { value: 'board', label: 'Board', icon: '▥' },
  { value: 'calendar', label: 'Calendar', icon: '▨' },
  { value: 'timeline', label: 'Timeline', icon: '━' },
  { value: 'graph', label: 'Graph', icon: '◎' },
  { value: 'tree', label: 'Tree', icon: '⊞' },
  { value: 'stat-cards', label: 'Stat Cards', icon: '▣' },
  { value: 'detail', label: 'Detail', icon: '▤' },
  { value: 'content-body', label: 'Content Body', icon: '¶' },
];

const FORMATTER_OPTIONS = [
  '', 'badge', 'boolean-badge', 'date', 'json-count', 'schema-badges', 'code', 'truncate', 'json',
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-md-size)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--spacing-xs)',
  fontSize: 'var(--typography-label-md-size)',
  fontWeight: 'var(--typography-label-md-weight)' as unknown as number,
  color: 'var(--palette-on-surface)',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--spacing-md)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--typography-title-sm-size, 14px)',
  fontWeight: 'var(--typography-title-sm-weight, 600)' as unknown as number,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParse<T>(json: string | undefined | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Panel wrapper — a themed Card section with a title */
const EditorPanel: React.FC<{
  title: string;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}> = ({ title, badge, actions, children, collapsed, onToggle }) => (
  <Card variant="outlined" style={{ marginBottom: 'var(--spacing-md)' }}>
    <div style={sectionHeaderStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        {onToggle && (
          <button
            onClick={onToggle}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--palette-on-surface-variant)', fontSize: '12px', padding: 0,
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
        <h3 style={sectionTitleStyle}>{title}</h3>
        {badge && <Badge variant="info">{badge}</Badge>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>{actions}</div>}
    </div>
    {!collapsed && children}
  </Card>
);

// ── Source Selector ──────────────────────────────────────────────────────────

const SourceSelector: React.FC<{
  dataSource: DataSourceConfig;
  onChange: (ds: DataSourceConfig) => void;
}> = ({ dataSource, onChange }) => {
  const paramsStr = dataSource.params ? JSON.stringify(dataSource.params, null, 2) : '';
  const [paramsText, setParamsText] = useState(paramsStr);
  const [paramsError, setParamsError] = useState<string | null>(null);

  useEffect(() => {
    setParamsText(dataSource.params ? JSON.stringify(dataSource.params, null, 2) : '');
  }, [dataSource.params]);

  const handleParamsChange = useCallback((text: string) => {
    setParamsText(text);
    if (!text.trim()) {
      setParamsError(null);
      onChange({ ...dataSource, params: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setParamsError(null);
      onChange({ ...dataSource, params: parsed });
    } catch {
      setParamsError('Invalid JSON');
    }
  }, [dataSource, onChange]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
      <div>
        <label style={labelStyle}>Concept</label>
        <input
          type="text"
          value={dataSource.concept}
          onChange={(e) => onChange({ ...dataSource, concept: e.target.value })}
          placeholder="e.g. ContentNode"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Action</label>
        <input
          type="text"
          value={dataSource.action}
          onChange={(e) => onChange({ ...dataSource, action: e.target.value })}
          placeholder="e.g. list"
          style={inputStyle}
        />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>
          Parameters <span style={{ fontWeight: 'normal', color: 'var(--palette-on-surface-variant)' }}>(JSON, optional)</span>
        </label>
        <textarea
          value={paramsText}
          onChange={(e) => handleParamsChange(e.target.value)}
          placeholder='{"schemaFilter": "Article"}'
          rows={3}
          style={{
            ...inputStyle,
            fontFamily: 'var(--typography-font-family-mono)',
            fontSize: 'var(--typography-code-sm-size)',
            resize: 'vertical',
          }}
        />
        {paramsError && (
          <span style={{ color: 'var(--palette-error)', fontSize: 'var(--typography-body-sm-size)' }}>{paramsError}</span>
        )}
      </div>
    </div>
  );
};

// ── Style Selector ───────────────────────────────────────────────────────────

const StyleSelector: React.FC<{
  layout: string;
  onChange: (layout: string) => void;
}> = ({ layout, onChange }) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)',
  }}>
    {LAYOUT_OPTIONS.map((opt) => {
      const isActive = layout === opt.value;
      return (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          data-part="button"
          data-variant={isActive ? 'filled' : 'outlined'}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            fontSize: 'var(--typography-body-sm-size)',
            ...(isActive ? {} : { opacity: 0.7 }),
          }}
        >
          <span style={{ fontFamily: 'monospace' }}>{opt.icon}</span>
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ── Field Configurator ───────────────────────────────────────────────────────

const FieldConfigurator: React.FC<{
  fields: FieldConfig[];
  onChange: (fields: FieldConfig[]) => void;
}> = ({ fields, onChange }) => {
  const addField = useCallback(() => {
    onChange([...fields, { key: '', label: '', visible: true }]);
  }, [fields, onChange]);

  const removeField = useCallback((index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  }, [fields, onChange]);

  const updateField = useCallback((index: number, patch: Partial<FieldConfig>) => {
    onChange(fields.map((f, i) => i === index ? { ...f, ...patch } : f));
  }, [fields, onChange]);

  const moveField = useCallback((index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }, [fields, onChange]);

  return (
    <div>
      {fields.length === 0 ? (
        <p style={{ color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-body-sm-size)' }}>
          No fields configured. Add fields to control which columns/properties are visible.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 1fr 120px 48px 48px 32px',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            background: 'var(--palette-surface-variant)',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            fontSize: 'var(--typography-label-sm-size)',
            fontWeight: 'var(--typography-label-md-weight)' as unknown as number,
            color: 'var(--palette-on-surface-variant)',
          }}>
            <span />
            <span>Key</span>
            <span>Label</span>
            <span>Formatter</span>
            <span style={{ textAlign: 'center' }}>Visible</span>
            <span style={{ textAlign: 'center' }}>Order</span>
            <span />
          </div>
          {/* Field rows */}
          {fields.map((field, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 1fr 120px 48px 48px 32px',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'var(--palette-surface)',
                borderBottom: '1px solid var(--palette-outline-variant)',
                alignItems: 'center',
              }}
            >
              {/* Drag handle placeholder */}
              <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: '10px', textAlign: 'center', cursor: 'grab' }}>⣿</span>
              {/* Key */}
              <input
                type="text"
                value={field.key}
                onChange={(e) => updateField(index, { key: e.target.value })}
                placeholder="field key"
                style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
              />
              {/* Label */}
              <input
                type="text"
                value={field.label ?? ''}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="display label"
                style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
              />
              {/* Formatter */}
              <select
                value={field.formatter ?? ''}
                onChange={(e) => updateField(index, { formatter: e.target.value || undefined })}
                style={{ ...inputStyle, padding: '2px 4px', fontSize: 'var(--typography-body-sm-size)' }}
              >
                <option value="">default</option>
                {FORMATTER_OPTIONS.filter(Boolean).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {/* Visible toggle */}
              <div style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={field.visible !== false}
                  onChange={(e) => updateField(index, { visible: e.target.checked })}
                />
              </div>
              {/* Order buttons */}
              <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                <button
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                  style={{
                    background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer',
                    color: 'var(--palette-on-surface-variant)', fontSize: '10px', padding: '0 2px',
                    opacity: index === 0 ? 0.3 : 1,
                  }}
                >▲</button>
                <button
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                  style={{
                    background: 'none', border: 'none', cursor: index === fields.length - 1 ? 'default' : 'pointer',
                    color: 'var(--palette-on-surface-variant)', fontSize: '10px', padding: '0 2px',
                    opacity: index === fields.length - 1 ? 0.3 : 1,
                  }}
                >▼</button>
              </div>
              {/* Remove */}
              <button
                onClick={() => removeField(index)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--palette-error)', fontSize: '14px', padding: 0,
                }}
                title="Remove field"
              >×</button>
            </div>
          ))}
        </div>
      )}
      <button
        data-part="button"
        data-variant="outlined"
        onClick={addField}
        style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--typography-body-sm-size)' }}
      >
        + Add Field
      </button>
    </div>
  );
};

// ── Filter Configurator ──────────────────────────────────────────────────────

const FilterConfigurator: React.FC<{
  filters: FilterConfig[];
  onChange: (filters: FilterConfig[]) => void;
}> = ({ filters, onChange }) => {
  const addFilter = useCallback(() => {
    onChange([...filters, { field: '', type: 'toggle-group' }]);
  }, [filters, onChange]);

  const removeFilter = useCallback((index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  }, [filters, onChange]);

  const updateFilter = useCallback((index: number, patch: Partial<FilterConfig>) => {
    onChange(filters.map((f, i) => i === index ? { ...f, ...patch } : f));
  }, [filters, onChange]);

  return (
    <div>
      {filters.length === 0 ? (
        <p style={{ color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-body-sm-size)' }}>
          No filters configured. Add filters to let users narrow results in the view header.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {filters.map((filter, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 32px',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm)',
                background: 'var(--palette-surface)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 'var(--radius-sm)',
                alignItems: 'end',
              }}
            >
              <div>
                <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>Field</label>
                <input
                  type="text"
                  value={filter.field}
                  onChange={(e) => updateFilter(index, { field: e.target.value })}
                  placeholder="e.g. schemas"
                  style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>Label</label>
                <input
                  type="text"
                  value={filter.label ?? ''}
                  onChange={(e) => updateFilter(index, { label: e.target.value || undefined })}
                  placeholder="display label"
                  style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>Type</label>
                <select
                  value={filter.type}
                  onChange={(e) => updateFilter(index, { type: e.target.value as 'toggle-group' })}
                  style={{ ...inputStyle, padding: '2px 4px', fontSize: 'var(--typography-body-sm-size)' }}
                >
                  <option value="toggle-group">Toggle Group</option>
                </select>
              </div>
              <button
                onClick={() => removeFilter(index)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--palette-error)', fontSize: '14px', padding: 0,
                  alignSelf: 'center',
                }}
                title="Remove filter"
              >×</button>
            </div>
          ))}
        </div>
      )}
      <button
        data-part="button"
        data-variant="outlined"
        onClick={addFilter}
        style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--typography-body-sm-size)' }}
      >
        + Add Filter
      </button>
    </div>
  );
};

// ── Sort/Group Configurator ──────────────────────────────────────────────────

const SortGroupConfigurator: React.FC<{
  sorts: SortConfig[];
  groups: string;
  onSortsChange: (sorts: SortConfig[]) => void;
  onGroupsChange: (groups: string) => void;
}> = ({ sorts, groups, onSortsChange, onGroupsChange }) => {
  const addSort = useCallback(() => {
    onSortsChange([...sorts, { field: '', direction: 'asc' }]);
  }, [sorts, onSortsChange]);

  const removeSort = useCallback((index: number) => {
    onSortsChange(sorts.filter((_, i) => i !== index));
  }, [sorts, onSortsChange]);

  const updateSort = useCallback((index: number, patch: Partial<SortConfig>) => {
    onSortsChange(sorts.map((s, i) => i === index ? { ...s, ...patch } : s));
  }, [sorts, onSortsChange]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
      {/* Sort */}
      <div>
        <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as unknown as number }}>
          Sort Order
        </h4>
        {sorts.length === 0 ? (
          <p style={{ color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-body-sm-size)' }}>
            Default sort order.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {sorts.map((sort, index) => (
              <div key={index} style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                <input
                  type="text"
                  value={sort.field}
                  onChange={(e) => updateSort(index, { field: e.target.value })}
                  placeholder="field"
                  style={{ ...inputStyle, flex: 1, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                />
                <select
                  value={sort.direction}
                  onChange={(e) => updateSort(index, { direction: e.target.value as 'asc' | 'desc' })}
                  style={{ ...inputStyle, width: '70px', padding: '2px 4px', fontSize: 'var(--typography-body-sm-size)' }}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
                <button
                  onClick={() => removeSort(index)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-error)', fontSize: '14px', padding: 0 }}
                >×</button>
              </div>
            ))}
          </div>
        )}
        <button
          data-part="button"
          data-variant="outlined"
          onClick={addSort}
          style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--typography-body-sm-size)' }}
        >
          + Add Sort
        </button>
      </div>

      {/* Group */}
      <div>
        <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as unknown as number }}>
          Grouping
        </h4>
        <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>
          Group by field <span style={{ fontWeight: 'normal', color: 'var(--palette-on-surface-variant)' }}>(for board/kanban: column field)</span>
        </label>
        <input
          type="text"
          value={groups}
          onChange={(e) => onGroupsChange(e.target.value)}
          placeholder="e.g. status"
          style={inputStyle}
        />
      </div>
    </div>
  );
};

// ── Controls Configurator ────────────────────────────────────────────────────

const ControlsConfigurator: React.FC<{
  controls: ControlsConfig;
  onChange: (controls: ControlsConfig) => void;
}> = ({ controls, onChange }) => {
  const [createFieldsText, setCreateFieldsText] = useState(
    controls.create?.fields ? JSON.stringify(controls.create.fields, null, 2) : ''
  );
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const handleCreateFieldsChange = useCallback((text: string) => {
    setCreateFieldsText(text);
    if (!text.trim()) {
      setFieldsError(null);
      if (controls.create) {
        onChange({ ...controls, create: { ...controls.create, fields: [] } });
      }
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setFieldsError(null);
      if (controls.create) {
        onChange({ ...controls, create: { ...controls.create, fields: parsed } });
      }
    } catch {
      setFieldsError('Invalid JSON');
    }
  }, [controls, onChange]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
      {/* Create button */}
      <div>
        <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as unknown as number }}>
          Create Button
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
          <input
            type="checkbox"
            checked={!!controls.create}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ ...controls, create: { concept: '', action: 'create', fields: [] } });
              } else {
                const { create: _, ...rest } = controls;
                onChange(rest);
              }
            }}
          />
          <span style={{ fontSize: 'var(--typography-body-sm-size)' }}>Enable create button</span>
        </div>
        {controls.create && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>Concept</label>
              <input
                type="text"
                value={controls.create.concept}
                onChange={(e) => onChange({ ...controls, create: { ...controls.create!, concept: e.target.value } })}
                placeholder="e.g. ContentNode"
                style={{ ...inputStyle, fontSize: 'var(--typography-body-sm-size)' }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>Action</label>
              <input
                type="text"
                value={controls.create.action}
                onChange={(e) => onChange({ ...controls, create: { ...controls.create!, action: e.target.value } })}
                placeholder="e.g. create"
                style={{ ...inputStyle, fontSize: 'var(--typography-body-sm-size)' }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>
                Fields <span style={{ fontWeight: 'normal', color: 'var(--palette-on-surface-variant)' }}>(JSON array)</span>
              </label>
              <textarea
                value={createFieldsText}
                onChange={(e) => handleCreateFieldsChange(e.target.value)}
                rows={4}
                style={{
                  ...inputStyle,
                  fontFamily: 'var(--typography-font-family-mono)',
                  fontSize: 'var(--typography-code-sm-size)',
                  resize: 'vertical',
                }}
              />
              {fieldsError && (
                <span style={{ color: 'var(--palette-error)', fontSize: 'var(--typography-body-sm-size)' }}>{fieldsError}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Row click */}
      <div>
        <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as unknown as number }}>
          Row Click
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
          <input
            type="checkbox"
            checked={!!controls.rowClick}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ ...controls, rowClick: { navigateTo: '' } });
              } else {
                const { rowClick: _, ...rest } = controls;
                onChange(rest);
              }
            }}
          />
          <span style={{ fontSize: 'var(--typography-body-sm-size)' }}>Enable row click navigation</span>
        </div>
        {controls.rowClick && (
          <div>
            <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>
              Navigate to <span style={{ fontWeight: 'normal', color: 'var(--palette-on-surface-variant)' }}>(use {'{field}'} for row values)</span>
            </label>
            <input
              type="text"
              value={controls.rowClick.navigateTo}
              onChange={(e) => onChange({ ...controls, rowClick: { navigateTo: e.target.value } })}
              placeholder="/content/{node}"
              style={inputStyle}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main ViewEditor ──────────────────────────────────────────────────────────

export const ViewEditor: React.FC<ViewEditorProps> = ({ viewId }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  // Load the current view config
  const { data: viewConfig, loading, error, refetch } =
    useConceptQuery<ViewConfig>('View', 'get', { view: viewId });

  // Editor state — initialized from loaded config
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<DataSourceConfig>({ concept: '', action: 'list' });
  const [layout, setLayout] = useState('table');
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [groups, setGroups] = useState('');
  const [controls, setControls] = useState<ControlsConfig>({});
  const [initialized, setInitialized] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Panel collapse state
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  const togglePanel = useCallback((panel: string) => {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

  // Preview toggle
  const [showPreview, setShowPreview] = useState(true);

  // Preview key — incremented to force preview re-render on save
  const [previewKey, setPreviewKey] = useState(0);

  // Initialize state from loaded config
  useEffect(() => {
    if (viewConfig && !initialized) {
      setTitle(viewConfig.title ?? '');
      setDescription(viewConfig.description ?? '');
      setDataSource(safeParse<DataSourceConfig>(viewConfig.dataSource, { concept: '', action: 'list' }));
      setLayout(viewConfig.layout ?? 'table');
      setFields(safeParse<FieldConfig[]>(viewConfig.visibleFields, []));
      setFilters(safeParse<FilterConfig[]>(viewConfig.filters, []));
      setSorts(safeParse<SortConfig[]>(viewConfig.sorts, []));
      setGroups(safeParse<string>(viewConfig.groups, '') || (typeof viewConfig.groups === 'string' && !viewConfig.groups.startsWith('[') ? viewConfig.groups : ''));
      setControls(safeParse<ControlsConfig>(viewConfig.controls, {}));
      setInitialized(true);
    }
  }, [viewConfig, initialized]);

  // Build the config object for save
  const buildConfig = useCallback((): Record<string, string> => ({
    view: viewId,
    title,
    description,
    dataSource: JSON.stringify(dataSource),
    layout,
    visibleFields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    sorts: JSON.stringify(sorts),
    groups: groups ? JSON.stringify(groups) : '[]',
    controls: JSON.stringify(controls),
  }), [viewId, title, description, dataSource, layout, fields, filters, sorts, groups, controls]);

  // Dirty check — compare current state to loaded config
  const isDirty = useMemo(() => {
    if (!viewConfig || !initialized) return false;
    const current = buildConfig();
    return (
      current.title !== (viewConfig.title ?? '') ||
      current.description !== (viewConfig.description ?? '') ||
      current.dataSource !== (viewConfig.dataSource ?? '') ||
      current.layout !== (viewConfig.layout ?? '') ||
      current.visibleFields !== (viewConfig.visibleFields ?? '[]') ||
      current.filters !== (viewConfig.filters ?? '[]') ||
      current.sorts !== (viewConfig.sorts ?? '[]') ||
      current.controls !== (viewConfig.controls ?? '{}')
    );
  }, [viewConfig, initialized, buildConfig]);

  // Save handler
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const config = buildConfig();
      const result = await invoke('View', 'update', config);
      if (result.variant === 'ok') {
        setSaveSuccess(true);
        setPreviewKey((k) => k + 1);
        refetch();
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setSaveError(result.message as string ?? `Save failed: ${result.variant}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [buildConfig, invoke, refetch]);

  // Loading state
  if (loading && !viewConfig) {
    return (
      <div>
        <div className="page-header"><h1>Loading view...</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading view configuration...</p>
      </div>
    );
  }

  if (error || !viewConfig) {
    return (
      <div>
        <div className="page-header">
          <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/view-builder')}>
            Back to Views
          </button>
          <h1>View Not Found</h1>
        </div>
        <Card variant="outlined">
          <p style={{ color: 'var(--palette-error)' }}>View &quot;{viewId}&quot; not found. {error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <button data-part="button" data-variant="outlined" onClick={() => navigateToHref('/view-builder')}>
            Back
          </button>
          <h1 style={{ margin: 0 }}>Edit View</h1>
          <Badge variant="info">{viewId}</Badge>
          {isDirty && <Badge variant="warning">Unsaved</Badge>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <button
            data-part="button"
            data-variant="outlined"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            data-part="button"
            data-variant="filled"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* ViewEditorToolbar — save button integrated into the toolbar pattern */}
      <div style={{ marginBottom: 'var(--spacing-md)', border: '1px solid var(--palette-outline-variant)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <ViewEditorToolbar
          availableFields={fields.map((f) => ({ key: f.key, label: f.label ?? f.key }))}
          filterConditions={[]}
          onFilterConditionsChange={() => undefined}
          sortKeys={sorts.map((s) => ({ field: s.field, direction: s.direction }))}
          onSortKeysChange={(keys) => setSorts(keys.map((k) => ({ field: k.field, direction: k.direction })))}
          groupConfig={groups ? { field: groups } : null}
          onGroupConfigChange={(cfg) => setGroups(cfg?.field ?? '')}
          fieldVisibility={fields.map((f) => ({ key: f.key, label: f.label, visible: f.visible !== false }))}
          onFieldVisibilityChange={(vis) => {
            setFields(fields.map((f) => {
              const v = vis.find((vi) => vi.key === f.key);
              return v !== undefined ? { ...f, visible: v.visible } : f;
            }));
          }}
          currentLayout={layout}
          onLayoutChange={setLayout}
          hasUnsavedChanges={isDirty}
          saveState={saving ? 'saving' : saveSuccess ? 'saved' : 'idle'}
          onSave={handleSave}
        />
      </div>

      {/* Save feedback */}
      {saveError && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--spacing-md)',
          fontSize: 'var(--typography-body-sm-size)',
        }}>
          {saveError}
        </div>
      )}

      {/* ── Editor / Preview split layout ─────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr',
        gap: 'var(--spacing-lg)',
        alignItems: 'start',
      }}>
        {/* ── Editor column ─────────────────────────────── */}
        <div>
          {/* Title & Description */}
          <EditorPanel title="General">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="View display title"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>View ID</label>
                <input
                  type="text"
                  value={viewId}
                  disabled
                  style={{ ...inputStyle, opacity: 0.6 }}
                />
              </div>
            </div>
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this view shows"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </EditorPanel>

          {/* Data Source */}
          <EditorPanel
            title="Data Source"
            badge={dataSource.concept ? `${dataSource.concept}/${dataSource.action}` : undefined}
            collapsed={collapsedPanels['source']}
            onToggle={() => togglePanel('source')}
          >
            <SourceSelector dataSource={dataSource} onChange={setDataSource} />
          </EditorPanel>

          {/* Display Style */}
          <EditorPanel
            title="Display Style"
            badge={layout}
            collapsed={collapsedPanels['style']}
            onToggle={() => togglePanel('style')}
          >
            <StyleSelector layout={layout} onChange={setLayout} />
          </EditorPanel>

          {/* Fields */}
          <EditorPanel
            title="Fields / Columns"
            badge={`${fields.length}`}
            collapsed={collapsedPanels['fields']}
            onToggle={() => togglePanel('fields')}
          >
            <FieldConfigurator fields={fields} onChange={setFields} />
          </EditorPanel>

          {/* Filters */}
          <EditorPanel
            title="Filters"
            badge={filters.length > 0 ? `${filters.length}` : undefined}
            collapsed={collapsedPanels['filters']}
            onToggle={() => togglePanel('filters')}
          >
            <FilterConfigurator filters={filters} onChange={setFilters} />
          </EditorPanel>

          {/* Sort & Group */}
          <EditorPanel
            title="Sort & Group"
            collapsed={collapsedPanels['sortgroup']}
            onToggle={() => togglePanel('sortgroup')}
          >
            <SortGroupConfigurator
              sorts={sorts}
              groups={groups}
              onSortsChange={setSorts}
              onGroupsChange={setGroups}
            />
          </EditorPanel>

          {/* Controls */}
          <EditorPanel
            title="Controls"
            collapsed={collapsedPanels['controls']}
            onToggle={() => togglePanel('controls')}
          >
            <ControlsConfigurator controls={controls} onChange={setControls} />
          </EditorPanel>

          {/* Raw JSON view (collapsed by default) */}
          <EditorPanel
            title="Raw Config"
            collapsed={collapsedPanels['raw'] !== false}
            onToggle={() => togglePanel('raw')}
          >
            <pre style={{
              fontFamily: 'var(--typography-font-family-mono)',
              fontSize: 'var(--typography-code-sm-size)',
              background: 'var(--palette-surface-variant)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'auto',
              maxHeight: 400,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {JSON.stringify(buildConfig(), null, 2)}
            </pre>
          </EditorPanel>
        </div>

        {/* ── Preview column ────────────────────────────── */}
        {showPreview && (
          <div style={{
            position: 'sticky',
            top: 'var(--spacing-lg)',
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
          }}>
            <Card variant="outlined" style={{ marginBottom: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
                <h3 style={sectionTitleStyle}>Live Preview</h3>
                <Badge variant="secondary">
                  {layout}
                </Badge>
              </div>
              <p style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)', margin: '0 0 var(--spacing-sm) 0' }}>
                Save changes to update the preview.
              </p>
            </Card>
            <div key={previewKey}>
              <ViewRenderer viewId={viewId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewEditor;
