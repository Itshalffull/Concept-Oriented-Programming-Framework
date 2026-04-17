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

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Card } from './widgets/Card';
import { Badge } from './widgets/Badge';
import { useConceptQuery } from '../../lib/use-concept-query';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';
import { ViewRenderer } from './ViewRenderer';
import { ViewEditorToolbar } from './widgets/ViewEditorToolbar';
import {
  BindingEditor,
  emptyBindingValue,
  migrateBindingValue,
  type BindingValue,
} from './widgets/BindingEditor';
import { ConceptActionPicker } from './widgets/ConceptActionPicker';
import type { ConceptActionSpec as _ConceptActionSpec } from './widgets/ConceptActionPicker';

/** Extended action spec that includes input param definitions */
interface ConceptActionSpec extends _ConceptActionSpec {
  inputs?: Array<{ name: string; type: string; required?: boolean }>;
}
import { FieldPickerDropdown, type FieldDef } from './widgets/FieldPickerDropdown';
import { OperatorDropdown, type FieldType, getOperatorsForType, isUnaryOperator } from './widgets/OperatorDropdown';
import { TypedValueInput } from './widgets/TypedValueInput';

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
  id: string;
  field: string;
  fieldType: FieldType;
  operator: string;
  value: string;
  /** legacy fields — preserved for round-trip serialization */
  label?: string;
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
    /** Legacy href template, kept for back-compat; new editor uses `binding`. */
    navigateTo?: string;
    /** Action / UI Event / Composite binding fired on row click. */
    binding?: BindingValue;
  };
  rowActions?: Array<{
    key: string;
    label: string;
    /** Legacy fields — kept for back-compat; new editor persists `binding`. */
    concept?: string;
    action?: string;
    params?: Record<string, string>;
    /** Action / UI Event / Composite binding for this row action. */
    binding?: BindingValue;
  }>;
  bulkActions?: Array<{
    key: string;
    label: string;
    concept: string;
    action: string;
  }>;
}

interface ViewEditorProps {
  viewId: string;
  mode?: 'create' | 'edit';
  context?: ViewConfig | null;
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

/** Map a concept spec type string to a FieldPickerDropdown FieldType */
function conceptTypeToFieldType(typeStr: string): FieldType {
  const t = (typeStr ?? '').toLowerCase().trim();
  if (t === 'bool' || t === 'boolean') return 'boolean';
  if (t === 'int' || t === 'float' || t === 'number') return 'number';
  if (t === 'date' || t === 'datetime') return 'date';
  if (t.startsWith('list') || t.startsWith('set ') || t === 'set') return 'multi-select';
  if (t.startsWith('union') || t.includes('|')) return 'select';
  return 'string';
}

/** Map an action input param type to a FieldType for the typed param widget */
function paramTypeToFieldType(typeStr: string): FieldType {
  return conceptTypeToFieldType(typeStr);
}

/** Extract a unique id for a filter — stable across re-renders */
let _filterIdSeq = 1;
function newFilterId(): string {
  return `filter-${Date.now()}-${_filterIdSeq++}`;
}

// ── BindingValue helpers for rowClick / rowActions ────────────────────────────

/**
 * Hydrate a rowClick config into a BindingValue. Legacy
 * `{navigateTo: "..."}` becomes a UI-event Navigate binding whose
 * params JSON carries the href template.
 */
function hydrateRowClickBinding(rc: ControlsConfig['rowClick']): BindingValue {
  if (!rc) return { mode: 'ui-event', uiEvent: { kind: 'navigate', target: '', params: '{}' } };
  if (rc.binding) return migrateBindingValue(rc.binding);
  const href = rc.navigateTo ?? '';
  return {
    mode: 'ui-event',
    uiEvent: {
      kind: 'navigate',
      target: '',
      params: JSON.stringify({ href }),
    },
  };
}

/**
 * Hydrate a rowAction config into a BindingValue. Legacy
 * `{concept, action, params?}` becomes an Action-mode binding.
 */
function hydrateRowActionBinding(ra: {
  concept?: string; action?: string; params?: Record<string, string>; binding?: BindingValue;
}): BindingValue {
  if (ra.binding) return migrateBindingValue(ra.binding);
  return {
    mode: 'action',
    action: {
      concept: ra.concept ?? '',
      action: ra.action ?? '',
      inputs: ra.params ?? {},
    },
  };
}

/**
 * Project a BindingValue back into the legacy rowClick shape so existing
 * consumers (ViewRenderer rowClick handler) keep working. Action-mode
 * bindings project to navigateTo = "<concept>/<action>"; UI-event
 * Navigate bindings project the href param to navigateTo.
 */
function serializeRowClickBinding(binding: BindingValue): NonNullable<ControlsConfig['rowClick']> {
  if (binding.mode === 'ui-event' && binding.uiEvent?.kind === 'navigate') {
    let href = '';
    try {
      const params = JSON.parse(binding.uiEvent.params || '{}');
      if (typeof params.href === 'string') href = params.href;
    } catch { /* ignore */ }
    return { navigateTo: href, binding };
  }
  if (binding.mode === 'action' && binding.action) {
    const navigateTo = binding.action.concept && binding.action.action
      ? `${binding.action.concept}/${binding.action.action}`
      : '';
    return { navigateTo, binding };
  }
  return { navigateTo: '', binding };
}

type RowAction = NonNullable<ControlsConfig['rowActions']>[number];

/**
 * Project a BindingValue back into the legacy rowAction shape
 * (concept/action/params) for existing consumers.
 */
function serializeRowActionBinding(
  key: string,
  label: string,
  binding: BindingValue,
): RowAction {
  if (binding.mode === 'action' && binding.action) {
    return {
      key,
      label,
      concept: binding.action.concept,
      action: binding.action.action,
      params: binding.action.inputs,
      binding,
    };
  }
  return { key, label, concept: '', action: '', binding };
}

// ── Hook: concept state fields from ScoreApi ─────────────────────────────────

interface ConceptStateField {
  name: string;
  type: string;
}

const _stateFieldsCache = new Map<string, ConceptStateField[]>();

function useConceptStateFields(conceptName: string): ConceptStateField[] {
  const invoke = useKernelInvoke();
  const [fields, setFields] = useState<ConceptStateField[]>(() => _stateFieldsCache.get(conceptName) ?? []);
  const lastFetched = useRef<string>('');

  useEffect(() => {
    if (!conceptName || lastFetched.current === conceptName) return;
    const cached = _stateFieldsCache.get(conceptName);
    if (cached) { setFields(cached); lastFetched.current = conceptName; return; }
    lastFetched.current = conceptName;
    invoke('ScoreApi', 'getConcept', { name: conceptName })
      .then((result: Record<string, unknown>) => {
        if (result.variant !== 'ok') return;
        // getConcept returns stateFields as array of {name, type} or strings
        let raw: unknown[] = [];
        if (Array.isArray(result.stateFields)) raw = result.stateFields as unknown[];
        else if (typeof result.stateFields === 'string') {
          try { raw = JSON.parse(result.stateFields as string); } catch { raw = []; }
        }
        const parsed: ConceptStateField[] = raw.map((f) => {
          if (typeof f === 'string') return { name: f, type: 'string' };
          const fo = f as Record<string, unknown>;
          return {
            name: String(fo.name ?? fo.key ?? ''),
            type: String(fo.type ?? fo.fieldType ?? 'string'),
          };
        }).filter((f) => f.name !== '');
        _stateFieldsCache.set(conceptName, parsed);
        setFields(parsed);
      })
      .catch(() => { /* silent — fall back to empty */ });
  }, [conceptName, invoke]);

  return fields;
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

/**
 * Schema-driven parameter editor for a concept action.
 *
 * When an action with a known signature is selected, renders one typed control
 * per input field (Boolean -> toggle, Number -> number input, Date -> date
 * picker, enum -> dropdown, String -> text input). Also exposes an "Additional
 * parameters" section for ad-hoc key/value pairs not present in the signature.
 *
 * Invariant: no raw JSON textarea is rendered when the action has a known
 * signature. The JSON textarea fallback is only shown if actionSpec is absent.
 */
const ParamEditor: React.FC<{
  actionSpec: ConceptActionSpec | null;
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
}> = ({ actionSpec, params, onChange }) => {
  // Additional (ad-hoc) params — key/value pairs not in the signature
  const knownKeys = useMemo(
    () => new Set((actionSpec?.inputs ?? []).map((f) => f.name)),
    [actionSpec],
  );
  const additionalEntries = useMemo(
    () => Object.entries(params).filter(([k]) => !knownKeys.has(k)),
    [params, knownKeys],
  );

  const setParam = useCallback((key: string, value: unknown) => {
    onChange({ ...params, [key]: value });
  }, [params, onChange]);

  const removeAdditional = useCallback((key: string) => {
    const next = { ...params };
    delete next[key];
    onChange(next);
  }, [params, onChange]);

  const addAdditional = useCallback(() => {
    onChange({ ...params, '': '' });
  }, [params, onChange]);

  const updateAdditionalKey = useCallback((oldKey: string, newKey: string) => {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  }, [params, onChange]);

  // Fallback: no action spec — show generic key/value editor (never a JSON textarea)
  if (!actionSpec || !actionSpec.inputs || actionSpec.inputs.length === 0) {
    return (
      <div>
        <label style={{ ...labelStyle, color: 'var(--palette-on-surface-variant)', fontWeight: 'normal' }}>
          Parameters (no declared inputs)
        </label>
        {additionalEntries.map(([key, val]) => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
            <input
              type="text"
              value={key}
              onChange={(e) => updateAdditionalKey(key, e.target.value)}
              placeholder="param name"
              style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
            />
            <input
              type="text"
              value={String(val ?? '')}
              onChange={(e) => setParam(key, e.target.value)}
              placeholder="value"
              style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
            />
            <button onClick={() => removeAdditional(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-error)', fontSize: '14px' }}>×</button>
          </div>
        ))}
        <button
          data-part="button" data-variant="outlined"
          onClick={addAdditional}
          style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--typography-body-sm-size)' }}
        >
          + Add Parameter
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {/* Signature-driven typed fields */}
      {(actionSpec.inputs ?? []).map((field) => {
        const ft = paramTypeToFieldType(field.type);
        const rawVal = params[field.name];
        const strVal = rawVal === undefined || rawVal === null ? '' : String(rawVal);
        return (
          <div key={field.name} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <label style={{ ...labelStyle, marginBottom: 0, fontSize: 'var(--typography-label-sm-size)' }}>
              {field.name}
              <span style={{ marginLeft: 4, fontWeight: 'normal', color: 'var(--palette-on-surface-variant)', fontSize: '11px' }}>
                ({field.type})
              </span>
            </label>
            {ft === 'boolean' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--typography-body-sm-size)' }}>
                <input
                  type="checkbox"
                  checked={rawVal === true || rawVal === 'true'}
                  onChange={(e) => setParam(field.name, e.target.checked)}
                />
                {rawVal === true || rawVal === 'true' ? 'true' : 'false'}
              </label>
            ) : ft === 'number' ? (
              <input
                type="number"
                value={strVal}
                onChange={(e) => setParam(field.name, e.target.value === '' ? undefined : Number(e.target.value))}
                placeholder={field.name}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 'var(--typography-body-sm-size)' }}
              />
            ) : ft === 'date' ? (
              <input
                type="date"
                value={strVal}
                onChange={(e) => setParam(field.name, e.target.value)}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 'var(--typography-body-sm-size)' }}
              />
            ) : ft === 'select' ? (
              <select
                value={strVal}
                onChange={(e) => setParam(field.name, e.target.value)}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 'var(--typography-body-sm-size)' }}
              >
                <option value="">—</option>
                {/* Extract enum values from type like `union "a" | "b"` */}
                {(field.type.match(/"([^"]+)"/g) ?? []).map((m) => {
                  const v = m.replace(/"/g, '');
                  return <option key={v} value={v}>{v}</option>;
                })}
              </select>
            ) : (
              <input
                type="text"
                value={strVal}
                onChange={(e) => setParam(field.name, e.target.value)}
                placeholder={field.name}
                style={{ ...inputStyle, padding: '4px 8px', fontSize: 'var(--typography-body-sm-size)' }}
              />
            )}
          </div>
        );
      })}

      {/* Additional parameters not in the signature */}
      {additionalEntries.length > 0 && (
        <div style={{ borderTop: '1px solid var(--palette-outline-variant)', paddingTop: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
          <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
            Additional parameters
          </label>
          {additionalEntries.map(([key, val]) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
              <input
                type="text"
                value={key}
                onChange={(e) => updateAdditionalKey(key, e.target.value)}
                placeholder="param name"
                style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
              />
              <input
                type="text"
                value={String(val ?? '')}
                onChange={(e) => setParam(key, e.target.value)}
                placeholder="value"
                style={{ ...inputStyle, padding: '2px 6px', fontSize: 'var(--typography-body-sm-size)' }}
              />
              <button onClick={() => removeAdditional(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-error)', fontSize: '14px' }}>×</button>
            </div>
          ))}
        </div>
      )}
      <button
        data-part="button" data-variant="outlined"
        onClick={addAdditional}
        style={{ fontSize: 'var(--typography-body-sm-size)', alignSelf: 'flex-start' }}
      >
        + Add Parameter
      </button>
    </div>
  );
};

const SourceSelector: React.FC<{
  dataSource: DataSourceConfig;
  onChange: (ds: DataSourceConfig) => void;
}> = ({ dataSource, onChange }) => {
  const invoke = useKernelInvoke();
  const [actionSpec, setActionSpec] = useState<ConceptActionSpec | null>(null);

  // Fetch full action spec (with inputs) from ScoreApi when concept+action known
  useEffect(() => {
    if (!dataSource.concept || !dataSource.action) { setActionSpec(null); return; }
    invoke('ScoreApi', 'getAction', { concept: dataSource.concept, action: dataSource.action })
      .then((result: Record<string, unknown>) => {
        if (result.variant !== 'ok') return;
        const raw = (result.action ?? {}) as Record<string, unknown>;
        // Build augmented spec with inputs if available
        const inputs = Array.isArray(raw.inputs)
          ? (raw.inputs as Array<Record<string, unknown>>).map((i) => ({
              name: String(i.name ?? i.key ?? ''),
              type: String(i.type ?? 'String'),
              required: Boolean(i.required ?? false),
            })).filter((i) => i.name !== '')
          : Array.isArray(raw.params)
            ? (raw.params as Array<Record<string, unknown>>).map((i) => ({
                name: String(i.name ?? i.key ?? ''),
                type: String(i.type ?? 'String'),
                required: Boolean(i.required ?? false),
              })).filter((i) => i.name !== '')
            : [];
        setActionSpec({
          name: String(raw.name ?? dataSource.action),
          description: typeof raw.description === 'string' ? raw.description : undefined,
          variants: [],
          inputs,
        });
      })
      .catch(() => { /* silent — leave current spec */ });
  }, [dataSource.concept, dataSource.action, invoke]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--spacing-md)' }}>
      <div>
        <label style={labelStyle}>Concept / Action</label>
        <ConceptActionPicker
          value={dataSource.concept && dataSource.action ? { concept: dataSource.concept, action: dataSource.action } : undefined}
          onChange={(v) => {
            onChange({ ...dataSource, concept: v.concept, action: v.action });
            setActionSpec(null); // will be re-fetched by effect
          }}
          filter="query"
          placeholder="Search query actions…"
        />
      </div>
      <div>
        <label style={labelStyle}>Parameters</label>
        <ParamEditor
          actionSpec={actionSpec}
          params={dataSource.params ?? {}}
          onChange={(p) => onChange({ ...dataSource, params: Object.keys(p).length ? p : undefined })}
        />
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

/**
 * Notion-style filter condition builder.
 *
 * Each row is [field dropdown] [operator dropdown] [value input] [remove].
 * Field dropdown: concept state fields when concept is known; free-text fallback.
 * Operator dropdown: adapts to field type (string/number/date/boolean/select).
 * Value input: typed appropriately by TypedValueInput.
 *
 * Invariant: filter row MUST include field, operator, and value controls where
 * operator options depend on the resolved field type.
 */
const FilterConfigurator: React.FC<{
  filters: FilterConfig[];
  conceptName?: string;
  onChange: (filters: FilterConfig[]) => void;
}> = ({ filters, conceptName, onChange }) => {
  const stateFields = useConceptStateFields(conceptName ?? '');

  const availableFields: FieldDef[] = useMemo(() => {
    if (stateFields.length > 0) {
      return stateFields.map((f) => ({
        key: f.name,
        label: f.name,
        type: conceptTypeToFieldType(f.type) as FieldDef['type'],
      }));
    }
    // Fallback: synthesize from existing filter fields
    const seen = new Set<string>();
    return filters
      .filter((f) => f.field && !seen.has(f.field) && seen.add(f.field))
      .map((f) => ({ key: f.field, label: f.field, type: f.fieldType as FieldDef['type'] }));
  }, [stateFields, filters]);

  const addFilter = useCallback(() => {
    const firstField = availableFields[0];
    onChange([...filters, {
      id: newFilterId(),
      field: firstField?.key ?? '',
      fieldType: (firstField?.type as FieldType) ?? 'string',
      operator: getOperatorsForType((firstField?.type as FieldType) ?? 'string')[0]?.value ?? 'eq',
      value: '',
    }]);
  }, [filters, onChange, availableFields]);

  const removeFilter = useCallback((id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  }, [filters, onChange]);

  const updateFilter = useCallback((id: string, patch: Partial<FilterConfig>) => {
    onChange(filters.map((f) => f.id === id ? { ...f, ...patch } : f));
  }, [filters, onChange]);

  const handleFieldChange = useCallback((id: string, fieldKey: string, fieldType?: FieldDef['type']) => {
    const ft = (fieldType as FieldType) ?? 'string';
    const defaultOp = getOperatorsForType(ft)[0]?.value ?? 'eq';
    updateFilter(id, { field: fieldKey, fieldType: ft, operator: defaultOp, value: '' });
  }, [updateFilter]);

  return (
    <div>
      {filters.length === 0 ? (
        <p style={{ color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-body-sm-size)' }}>
          No filters configured. Add condition rows to filter the view results.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 1fr 28px',
            gap: 'var(--spacing-xs)',
            padding: '2px var(--spacing-xs)',
            fontSize: 'var(--typography-label-sm-size)',
            color: 'var(--palette-on-surface-variant)',
            fontWeight: 600,
          }}>
            <span>Field</span>
            <span>Operator</span>
            <span>Value</span>
            <span />
          </div>
          {/* Condition rows */}
          {filters.map((filter) => {
            const unary = isUnaryOperator(filter.operator, filter.fieldType);
            return (
              <div
                key={filter.id}
                data-part="filter-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 1fr 28px',
                  gap: 'var(--spacing-xs)',
                  alignItems: 'center',
                  padding: 'var(--spacing-xs)',
                  background: 'var(--palette-surface)',
                  border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {/* Field picker */}
                {availableFields.length > 0 ? (
                  <FieldPickerDropdown
                    fields={availableFields}
                    currentField={filter.field}
                    onChange={(key, ft) => handleFieldChange(filter.id, key, ft)}
                    groupBy="type"
                    placeholder="Select field…"
                  />
                ) : (
                  <input
                    type="text"
                    value={filter.field}
                    onChange={(e) => updateFilter(filter.id, { field: e.target.value })}
                    placeholder="field name"
                    style={{ ...inputStyle, padding: '4px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                  />
                )}
                {/* Operator dropdown */}
                <OperatorDropdown
                  fieldType={filter.fieldType}
                  currentOperator={filter.operator}
                  onChange={(op) => updateFilter(filter.id, { operator: op })}
                />
                {/* Typed value input */}
                <TypedValueInput
                  fieldType={filter.fieldType}
                  value={filter.value}
                  onChange={(v) => updateFilter(filter.id, { value: v })}
                  operatorIsUnary={unary}
                  placeholder="value"
                />
                {unary && <span />}
                {/* Remove */}
                <button
                  onClick={() => removeFilter(filter.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--palette-error)', fontSize: '14px', padding: 0,
                  }}
                  title="Remove filter"
                >×</button>
              </div>
            );
          })}
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

/**
 * Sort builder: each row is [field dropdown] [asc/desc toggle] [remove].
 * Field dropdown is populated from concept state fields when concept is known.
 *
 * Invariant: sort row MUST include field and direction controls.
 */
const SortGroupConfigurator: React.FC<{
  sorts: SortConfig[];
  groups: string;
  conceptName?: string;
  onSortsChange: (sorts: SortConfig[]) => void;
  onGroupsChange: (groups: string) => void;
}> = ({ sorts, groups, conceptName, onSortsChange, onGroupsChange }) => {
  const stateFields = useConceptStateFields(conceptName ?? '');

  const sortFields: FieldDef[] = useMemo(() => {
    if (stateFields.length > 0) {
      return stateFields.map((f) => ({ key: f.name, label: f.name, type: conceptTypeToFieldType(f.type) as FieldDef['type'] }));
    }
    // Fallback: unique fields from existing sorts
    const seen = new Set<string>();
    return sorts
      .filter((s) => s.field && !seen.has(s.field) && seen.add(s.field))
      .map((s) => ({ key: s.field, label: s.field }));
  }, [stateFields, sorts]);

  const addSort = useCallback(() => {
    const firstField = sortFields[0];
    onSortsChange([...sorts, { field: firstField?.key ?? '', direction: 'asc' }]);
  }, [sorts, onSortsChange, sortFields]);

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
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 'var(--spacing-xs)',
              padding: '2px 4px', fontSize: 'var(--typography-label-sm-size)',
              color: 'var(--palette-on-surface-variant)', fontWeight: 600,
            }}>
              <span>Field</span>
              <span>Direction</span>
              <span />
            </div>
            {sorts.map((sort, index) => (
              <div key={index} data-part="sort-row" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                {/* Field picker or text input fallback */}
                {sortFields.length > 0 ? (
                  <FieldPickerDropdown
                    fields={sortFields}
                    currentField={sort.field}
                    onChange={(key) => updateSort(index, { field: key })}
                    placeholder="Select field…"
                  />
                ) : (
                  <input
                    type="text"
                    value={sort.field}
                    onChange={(e) => updateSort(index, { field: e.target.value })}
                    placeholder="field"
                    style={{ ...inputStyle, padding: '4px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                  />
                )}
                <select
                  value={sort.direction}
                  onChange={(e) => updateSort(index, { direction: e.target.value as 'asc' | 'desc' })}
                  style={{ ...inputStyle, padding: '4px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                >
                  <option value="asc">Asc ↑</option>
                  <option value="desc">Desc ↓</option>
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

// ── Field type options for Create Button fields ──────────────────────────────

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'multi-select', label: 'Multi-select' },
];

// ── Controls Configurator ────────────────────────────────────────────────────

type CreateField = NonNullable<ControlsConfig['create']>['fields'][number];

const ControlsConfigurator: React.FC<{
  controls: ControlsConfig;
  onChange: (controls: ControlsConfig) => void;
}> = ({ controls, onChange }) => {
  const updateCreateField = useCallback((index: number, patch: Partial<CreateField>) => {
    if (!controls.create) return;
    const fields = controls.create.fields.map((f, i) => i === index ? { ...f, ...patch } : f);
    onChange({ ...controls, create: { ...controls.create, fields } });
  }, [controls, onChange]);

  const addCreateField = useCallback(() => {
    if (!controls.create) return;
    const fields = [...controls.create.fields, { name: '', label: '', type: 'string' }];
    onChange({ ...controls, create: { ...controls.create, fields } });
  }, [controls, onChange]);

  const removeCreateField = useCallback((index: number) => {
    if (!controls.create) return;
    const fields = controls.create.fields.filter((_, i) => i !== index);
    onChange({ ...controls, create: { ...controls.create, fields } });
  }, [controls, onChange]);

  const addRowAction = useCallback(() => {
    const newAction = { key: `row-action-${Date.now()}`, label: '', concept: '', action: '' };
    onChange({ ...controls, rowActions: [...(controls.rowActions ?? []), newAction] });
  }, [controls, onChange]);

  const updateRowAction = useCallback((index: number, field: string, value: string) => {
    const updated = (controls.rowActions ?? []).map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    onChange({ ...controls, rowActions: updated });
  }, [controls, onChange]);

  const removeRowAction = useCallback((index: number) => {
    const updated = (controls.rowActions ?? []).filter((_, i) => i !== index);
    onChange({ ...controls, rowActions: updated });
  }, [controls, onChange]);

  const addBulkAction = useCallback(() => {
    const newAction = { key: `bulk-action-${Date.now()}`, label: '', concept: '', action: '' };
    onChange({ ...controls, bulkActions: [...(controls.bulkActions ?? []), newAction] });
  }, [controls, onChange]);

  const updateBulkAction = useCallback((index: number, field: string, value: string) => {
    const updated = (controls.bulkActions ?? []).map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    onChange({ ...controls, bulkActions: updated });
  }, [controls, onChange]);

  const removeBulkAction = useCallback((index: number) => {
    const updated = (controls.bulkActions ?? []).filter((_, i) => i !== index);
    onChange({ ...controls, bulkActions: updated });
  }, [controls, onChange]);

  const actionRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr auto',
    gap: 'var(--spacing-sm)',
    alignItems: 'end',
    marginBottom: 'var(--spacing-sm)',
  };

  const removeButtonStyle: React.CSSProperties = {
    padding: '0 var(--spacing-sm)',
    height: '32px',
    border: '1px solid var(--palette-outline)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--palette-on-surface-variant)',
    cursor: 'pointer',
    fontSize: 'var(--typography-body-sm-size)',
  };

  const addButtonStyle: React.CSSProperties = {
    marginTop: 'var(--spacing-sm)',
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    border: '1px dashed var(--palette-outline)',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--palette-primary)',
    cursor: 'pointer',
    fontSize: 'var(--typography-body-sm-size)',
    width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Top row: Create Button + Row Click */}
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
                <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>Concept / Action</label>
                <ConceptActionPicker
                  value={controls.create.concept && controls.create.action ? { concept: controls.create.concept, action: controls.create.action } : undefined}
                  onChange={(v) => onChange({ ...controls, create: { ...controls.create!, concept: v.concept, action: v.action } })}
                  filter="all"
                  placeholder="Search actions…"
                />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>
                  Fields
                </label>
                {/* Structured field rows: name / label / type */}
                {(controls.create?.fields ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
                    {/* Header */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 100px 28px', gap: 'var(--spacing-xs)',
                      padding: '2px 4px', fontSize: 'var(--typography-label-sm-size)',
                      color: 'var(--palette-on-surface-variant)', fontWeight: 600,
                    }}>
                      <span>Name</span><span>Label</span><span>Type</span><span />
                    </div>
                    {(controls.create?.fields ?? []).map((field, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 28px', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateCreateField(idx, { name: e.target.value })}
                          placeholder="field name"
                          style={{ ...inputStyle, padding: '3px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                        />
                        <input
                          type="text"
                          value={field.label ?? ''}
                          onChange={(e) => updateCreateField(idx, { label: e.target.value || undefined })}
                          placeholder="display label"
                          style={{ ...inputStyle, padding: '3px 6px', fontSize: 'var(--typography-body-sm-size)' }}
                        />
                        <select
                          value={field.type ?? 'string'}
                          onChange={(e) => updateCreateField(idx, { type: e.target.value })}
                          style={{ ...inputStyle, padding: '3px 4px', fontSize: 'var(--typography-body-sm-size)' }}
                        >
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeCreateField(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--palette-error)', fontSize: '14px', padding: 0 }}
                          title="Remove field"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  data-part="button" data-variant="outlined"
                  onClick={addCreateField}
                  style={{ fontSize: 'var(--typography-body-sm-size)' }}
                >
                  + Add Field
                </button>
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
                  onChange({ ...controls, rowClick: serializeRowClickBinding({
                    mode: 'ui-event',
                    uiEvent: { kind: 'navigate', target: '', params: '{}' },
                  }) });
                } else {
                  const { rowClick: _, ...rest } = controls;
                  onChange(rest);
                }
              }}
            />
            <span style={{ fontSize: 'var(--typography-body-sm-size)' }}>Enable row click binding</span>
          </div>
          {controls.rowClick && (
            <div>
              <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)' }}>
                Binding <span style={{ fontWeight: 'normal', color: 'var(--palette-on-surface-variant)' }}>
                  (Action, UI Event, or Composite — Navigate params use {'{field}'} for row values)
                </span>
              </label>
              <BindingEditor
                value={hydrateRowClickBinding(controls.rowClick)}
                onChange={(binding) =>
                  onChange({ ...controls, rowClick: serializeRowClickBinding(binding) })
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Row Actions */}
      <div>
        <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as unknown as number }}>
          Row Actions
        </h4>
        {(controls.rowActions ?? []).length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {(controls.rowActions ?? []).map((ra, i) => (
              <div
                key={ra.key}
                style={{
                  border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--spacing-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={ra.label}
                    onChange={(e) => updateRowAction(i, 'label', e.target.value)}
                    placeholder="Label — e.g. Archive"
                    style={{ ...inputStyle, fontSize: 'var(--typography-body-sm-size)', flex: 1 }}
                  />
                  <button onClick={() => removeRowAction(i)} style={removeButtonStyle}>
                    Remove
                  </button>
                </div>
                <BindingEditor
                  value={hydrateRowActionBinding(ra)}
                  onChange={(binding) => {
                    const next = (controls.rowActions ?? []).map((row, idx) =>
                      idx === i
                        ? serializeRowActionBinding(row.key, row.label, binding)
                        : row,
                    );
                    onChange({ ...controls, rowActions: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <button onClick={addRowAction} style={addButtonStyle}>
          + Add Row Action
        </button>
      </div>

      {/* Bulk Actions */}
      <div>
        <h4 style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--typography-label-md-size)', fontWeight: 'var(--typography-label-md-weight)' as unknown as number }}>
          Bulk Actions
        </h4>
        {(controls.bulkActions ?? []).length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-xs)' }}>
            <div style={{ ...actionRowStyle, gridTemplateColumns: '1fr 1fr auto', marginBottom: 'var(--spacing-xs)' }}>
              <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)', marginBottom: 0 }}>Label</label>
              <label style={{ ...labelStyle, fontSize: 'var(--typography-label-sm-size)', marginBottom: 0 }}>Concept / Action</label>
              <span />
            </div>
            {(controls.bulkActions ?? []).map((ba, i) => (
              <div key={ba.key} style={{ ...actionRowStyle, gridTemplateColumns: '1fr 1fr auto' }}>
                <input
                  type="text"
                  value={ba.label}
                  onChange={(e) => updateBulkAction(i, 'label', e.target.value)}
                  placeholder="e.g. Delete Selected"
                  style={{ ...inputStyle, fontSize: 'var(--typography-body-sm-size)' }}
                />
                <ConceptActionPicker
                  value={ba.concept && ba.action ? { concept: ba.concept, action: ba.action } : undefined}
                  onChange={(v) => {
                    updateBulkAction(i, 'concept', v.concept);
                    updateBulkAction(i, 'action', v.action);
                  }}
                  filter="all"
                  placeholder="Search actions…"
                />
                <button onClick={() => removeBulkAction(i)} style={removeButtonStyle}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addBulkAction} style={addButtonStyle}>
          + Add Bulk Action
        </button>
      </div>
    </div>
  );
};

// ── Main ViewEditor ──────────────────────────────────────────────────────────

export const ViewEditor: React.FC<ViewEditorProps> = ({ viewId, mode = 'edit', context }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const isCreate = mode === 'create';

  // Load the current view config (skipped in create mode — no entity to load yet)
  const { data: viewConfig, loading, error, refetch } =
    useConceptQuery<ViewConfig>(
      isCreate ? '__none__' : 'View',
      isCreate ? '__none__' : 'get',
      isCreate ? {} : { view: viewId },
    );

  // Editor state — empty defaults for create mode, loaded from config for edit mode
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<DataSourceConfig>({ concept: '', action: 'list' });
  const [layout, setLayout] = useState('table');
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [groups, setGroups] = useState('');
  const [controls, setControls] = useState<ControlsConfig>({});
  const [initialized, setInitialized] = useState(isCreate); // create mode is pre-initialized with empty defaults

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
      setFilters(
        safeParse<FilterConfig[]>(viewConfig.filters, []).map((f, i) => ({
          id: (f as { id?: string }).id ?? newFilterId(),
          field: f.field ?? '',
          fieldType: (f as { fieldType?: FieldType }).fieldType ?? 'string',
          operator: (f as { operator?: string }).operator ?? 'eq',
          value: (f as { value?: string }).value ?? '',
          label: f.label,
        }))
      );
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

  // Save handler — create path when mode === 'create', update path otherwise
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const config = buildConfig();
      const result = isCreate
        ? await invoke('View', 'create', config)
        : await invoke('View', 'update', config);
      if (result.variant === 'ok') {
        setSaveSuccess(true);
        setPreviewKey((k) => k + 1);
        if (!isCreate) refetch();
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setSaveError(result.message as string ?? `Save failed: ${result.variant}`);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [buildConfig, invoke, refetch, isCreate]);

  // Loading state (only in edit mode — create mode has no entity to load)
  if (!isCreate && loading && !viewConfig) {
    return (
      <div>
        <div className="page-header"><h1>Loading view...</h1></div>
        <p style={{ color: 'var(--palette-on-surface-variant)' }}>Loading view configuration...</p>
      </div>
    );
  }

  if (!isCreate && (error || !viewConfig)) {
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
          <h1 style={{ margin: 0 }}>{isCreate ? 'Create View' : 'Edit View'}</h1>
          {!isCreate && <Badge variant="info">{viewId}</Badge>}
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
            {saving ? 'Saving...' : saveSuccess ? 'Saved' : isCreate ? 'Create View' : 'Save'}
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
            <FilterConfigurator filters={filters} conceptName={dataSource.concept || undefined} onChange={setFilters} />
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
              conceptName={dataSource.concept || undefined}
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
