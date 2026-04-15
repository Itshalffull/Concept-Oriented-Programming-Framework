'use client';

/**
 * SchemaFieldsEditor — Level 3 full field list editor for /admin/schemas/:id.
 *
 * Shows all fields in a reorderable list. Each row has:
 *   drag handle | type icon | label | type badge | required indicator | unique indicator | gear
 *
 * Gear button opens an inline FieldConfigPanel on the right side of the row.
 * The panel has common controls (description, required, unique, default value)
 * and type-specific controls (Select/Multi-Select options editor).
 *
 * Each control calls FieldDefinition/update on blur/change (debounced 400 ms for text inputs).
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { useConceptQuery } from '../../../lib/use-concept-query';
import { FIELD_TYPE_REGISTRY } from './FieldWidget';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface SchemaFieldsEditorProps {
  schemaId: string;
  onFieldSelect?: (fieldId: string) => void;
  mode?: 'create' | 'edit';
  context?: { schemaId?: string; fields?: FieldRow[] } | null;
}

// ─── Local types ────────────────────────────────────────────────────────────────

interface FieldRow {
  id: string;
  label: string;
  type: string;
  fieldType?: string;
  required?: boolean;
  unique?: boolean;
  order?: number;
  description?: string;
  typeConfig?: string;
  defaultValue?: string;
  fieldId?: string;
}

interface SelectOption {
  label: string;
  value: string;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'var(--palette-surface)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  borderBottom: '1px solid var(--palette-outline)',
  flexShrink: 0,
};

const fieldListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const fieldRowBaseStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  padding: '8px var(--spacing-md)',
  borderBottom: '1px solid var(--palette-outline-variant)',
  cursor: 'pointer',
  userSelect: 'none',
  background: 'var(--palette-surface)',
  transition: 'background 0.1s',
};

const dragHandleStyle: React.CSSProperties = {
  cursor: 'grab',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 14,
  opacity: 0.5,
  flexShrink: 0,
  width: 16,
  textAlign: 'center',
};

const typeIconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: '3px',
  background: 'var(--palette-primary-container)',
  color: 'var(--palette-on-primary-container)',
  fontSize: '10px',
  fontWeight: 'bold',
  flexShrink: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--typography-body-sm-size)',
  color: 'var(--palette-on-surface)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const typeBadgeStyle: React.CSSProperties = {
  fontSize: '10px',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface-variant)',
  border: '1px solid var(--palette-outline)',
  flexShrink: 0,
};

const indicatorStyle = (active: boolean): React.CSSProperties => ({
  fontSize: '10px',
  padding: '1px 5px',
  borderRadius: 'var(--radius-sm)',
  background: active ? 'var(--palette-primary-container)' : 'transparent',
  color: active ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface-variant)',
  border: `1px solid ${active ? 'var(--palette-primary)' : 'transparent'}`,
  opacity: active ? 1 : 0.3,
  flexShrink: 0,
});

const gearBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 14,
  padding: '2px 4px',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
  opacity: 0.6,
  lineHeight: 1,
};

const gearBtnActiveStyle: React.CSSProperties = {
  ...gearBtnStyle,
  opacity: 1,
  background: 'var(--palette-primary-container)',
  color: 'var(--palette-on-primary-container)',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-error)',
  fontSize: 16,
  padding: '2px 4px',
  lineHeight: 1,
  flexShrink: 0,
  opacity: 0.6,
};

const addBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  padding: 'var(--spacing-xs) var(--spacing-md)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-primary)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  width: '100%',
  textAlign: 'left',
  borderTop: '1px solid var(--palette-outline-variant)',
};

const typePickerOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 999,
};

const typePickerPanelStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
  padding: 'var(--spacing-xs) 0',
  minWidth: 200,
  maxHeight: 340,
  overflowY: 'auto',
};

const typePickerItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  padding: '6px var(--spacing-md)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  color: 'var(--palette-on-surface)',
  background: 'none',
  border: 'none',
  width: '100%',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const groupLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 'bold',
  color: 'var(--palette-on-surface-variant)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '4px var(--spacing-md) 2px',
  opacity: 0.6,
};

const warningStyle: React.CSSProperties = {
  padding: 'var(--spacing-xs) var(--spacing-md)',
  background: 'var(--palette-error-container)',
  color: 'var(--palette-on-error-container)',
  fontSize: 'var(--typography-body-sm-size)',
  borderRadius: 'var(--radius-sm)',
  margin: 'var(--spacing-xs) var(--spacing-md)',
};

// ─── Config panel styles ────────────────────────────────────────────────────────

const configPanelStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 100,
  width: 320,
  background: 'var(--palette-surface)',
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 480,
  overflowY: 'auto',
};

const configPanelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px var(--spacing-md)',
  borderBottom: '1px solid var(--palette-outline-variant)',
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  background: 'var(--palette-surface)',
  zIndex: 1,
};

const configPanelTitleStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-md-size)',
  fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
  color: 'var(--palette-on-surface)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const configPanelCloseBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--palette-on-surface-variant)',
  fontSize: 18,
  lineHeight: 1,
  padding: '2px 4px',
  borderRadius: 'var(--radius-sm)',
  flexShrink: 0,
};

const configPanelBodyStyle: React.CSSProperties = {
  padding: 'var(--spacing-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-md)',
};

const formLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--palette-on-surface-variant)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
  display: 'block',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 56,
  boxSizing: 'border-box',
};

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const sectionDividerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--palette-outline-variant)',
  paddingTop: 'var(--spacing-md)',
};

// ─── FieldTypePicker ────────────────────────────────────────────────────────────

const GROUPS = ['text', 'number', 'date', 'choice', 'reference', 'special'] as const;
const GROUP_LABELS: Record<string, string> = {
  text: 'Text', number: 'Number', date: 'Date',
  choice: 'Choice', reference: 'Reference', special: 'Special',
};

interface TypePickerProps {
  anchorPos: { top: number; left: number };
  onSelect: (type: string) => void;
  onClose: () => void;
}

const FieldTypePicker: React.FC<TypePickerProps> = ({ anchorPos, onSelect, onClose }) => {
  const byGroup: Record<string, Array<[string, typeof FIELD_TYPE_REGISTRY[string]]>> = {};
  for (const [key, cfg] of Object.entries(FIELD_TYPE_REGISTRY)) {
    if (!byGroup[cfg.group]) byGroup[cfg.group] = [];
    byGroup[cfg.group].push([key, cfg]);
  }

  return (
    <>
      <div style={typePickerOverlayStyle} onClick={onClose} aria-hidden="true" />
      <div
        data-part="type-picker"
        style={{ ...typePickerPanelStyle, top: anchorPos.top, left: anchorPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {GROUPS.map(group => {
          const items = byGroup[group];
          if (!items?.length) return null;
          return (
            <div key={group}>
              <div style={groupLabelStyle}>{GROUP_LABELS[group]}</div>
              {items.map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  data-part="type-option"
                  style={typePickerItemStyle}
                  onClick={() => onSelect(key)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--palette-surface-variant)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'none';
                  }}
                >
                  <span style={{
                    ...typeIconStyle,
                    width: 18, height: 18, fontSize: '10px',
                  }}>
                    {cfg.icon}
                  </span>
                  <span>{cfg.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
};

// ─── SelectOptionsEditor ────────────────────────────────────────────────────────

interface SelectOptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
}

const SelectOptionsEditor: React.FC<SelectOptionsEditorProps> = ({ options, onChange }) => {
  const addOption = () => {
    const idx = options.length + 1;
    onChange([...options, { label: `Option ${idx}`, value: `option_${idx}` }]);
  };

  const removeOption = (index: number) => {
    const next = options.filter((_, i) => i !== index);
    onChange(next);
  };

  const updateOption = (index: number, field: 'label' | 'value', val: string) => {
    const next = options.map((o, i) => i === index ? { ...o, [field]: val } : o);
    onChange(next);
  };

  return (
    <div data-part="select-options-editor" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt, i) => (
        <div
          key={i}
          data-part="option-row"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <input
            type="text"
            data-part="option-label"
            placeholder="Label"
            value={opt.label}
            onChange={(e) => updateOption(i, 'label', e.target.value)}
            onBlur={(e) => updateOption(i, 'label', e.target.value)}
            style={{ ...inputStyle, flex: 3, padding: '4px 6px' }}
            aria-label={`Option ${i + 1} label`}
          />
          <input
            type="text"
            data-part="option-value"
            placeholder="Value"
            value={opt.value}
            onChange={(e) => updateOption(i, 'value', e.target.value)}
            onBlur={(e) => updateOption(i, 'value', e.target.value)}
            style={{ ...inputStyle, flex: 2, padding: '4px 6px' }}
            aria-label={`Option ${i + 1} value`}
          />
          <button
            type="button"
            data-part="remove-option-button"
            aria-label={`Remove option ${i + 1}`}
            onClick={() => removeOption(i)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--palette-error)',
              fontSize: 16,
              lineHeight: 1,
              padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        data-part="add-option-button"
        onClick={addOption}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--palette-primary)',
          fontSize: 'var(--typography-body-sm-size)',
          fontFamily: 'inherit',
          padding: '2px 0',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14 }}>+</span>
        <span>Add option</span>
      </button>
    </div>
  );
};

// ─── FieldConfigPanel ──────────────────────────────────────────────────────────

interface FieldConfigPanelProps {
  field: FieldRow;
  schemaId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const FieldConfigPanel: React.FC<FieldConfigPanelProps> = ({
  field,
  schemaId,
  onClose,
  onUpdated,
}) => {
  const invoke = useKernelInvoke();

  // Local state mirroring the field's editable properties
  const [description, setDescription] = useState(field.description ?? '');
  const [required, setRequired] = useState(!!field.required);
  const [unique, setUnique] = useState(!!field.unique);
  const [defaultValue, setDefaultValue] = useState(field.defaultValue ?? '');

  // Parse typeConfig for Select/Multi-Select
  const parseOptions = (typeConfig?: string): SelectOption[] => {
    if (!typeConfig) return [];
    try {
      const parsed = JSON.parse(typeConfig);
      if (Array.isArray(parsed.options)) return parsed.options as SelectOption[];
    } catch { /* ignore */ }
    return [];
  };
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>(() =>
    parseOptions(field.typeConfig),
  );

  const fieldId = field.fieldId ?? field.id;
  const isSelectType = field.type === 'select' || field.type === 'multi-select' ||
    field.fieldType === 'select' || field.fieldType === 'multi-select';

  // Debounced update helper
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callUpdate = useCallback(async (patch: Record<string, unknown>) => {
    try {
      await invoke('FieldDefinition', 'update', {
        schema: schemaId,
        fieldId,
        ...patch,
      });
      onUpdated();
    } catch (err) {
      console.error('FieldConfigPanel: update failed', err);
    }
  }, [invoke, schemaId, fieldId, onUpdated]);

  const debouncedUpdate = useCallback((patch: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => callUpdate(patch), 400);
  }, [callUpdate]);

  // Keep local state in sync when field prop changes (e.g. after refetch)
  useEffect(() => {
    setDescription(field.description ?? '');
    setRequired(!!field.required);
    setUnique(!!field.unique);
    setDefaultValue(field.defaultValue ?? '');
    setSelectOptions(parseOptions(field.typeConfig));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleDescriptionBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Use the input's current value directly to avoid stale closure
    // when blur fires before React flushes a pending setDescription.
    const value = e.target.value;
    if (value !== field.description) {
      callUpdate({ description: value });
    }
  };

  const handleRequiredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setRequired(val);
    callUpdate({ required: val });
  };

  const handleUniqueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setUnique(val);
    callUpdate({ unique: val });
  };

  const handleDefaultValueBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value !== field.defaultValue) {
      callUpdate({ defaultValue: value });
    }
  };

  const handleSelectOptionsChange = (opts: SelectOption[]) => {
    setSelectOptions(opts);
    debouncedUpdate({ typeConfig: JSON.stringify({ options: opts }) });
  };

  return (
    <div
      data-part="config-panel"
      data-field-id={fieldId}
      style={configPanelStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div data-part="config-panel-header" style={configPanelHeaderStyle}>
        <span style={configPanelTitleStyle} title={`Edit ${field.label}`}>
          Edit {field.label}
        </span>
        <button
          type="button"
          data-part="config-panel-close"
          style={configPanelCloseBtnStyle}
          aria-label="Close config panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div data-part="config-panel-body" style={configPanelBodyStyle}>

        {/* Description */}
        <div>
          <label style={formLabelStyle} htmlFor={`desc-${fieldId}`}>Description</label>
          <textarea
            id={`desc-${fieldId}`}
            data-part="description-input"
            style={textareaStyle}
            value={description}
            placeholder="Describe this field..."
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={3}
          />
        </div>

        {/* Required */}
        <label style={checkboxRowStyle} htmlFor={`req-${fieldId}`}>
          <input
            id={`req-${fieldId}`}
            type="checkbox"
            data-part="required-checkbox"
            checked={required}
            onChange={handleRequiredChange}
          />
          <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface)' }}>
            Required
          </span>
        </label>

        {/* Unique */}
        <label style={checkboxRowStyle} htmlFor={`uniq-${fieldId}`}>
          <input
            id={`uniq-${fieldId}`}
            type="checkbox"
            data-part="unique-checkbox"
            checked={unique}
            onChange={handleUniqueChange}
          />
          <span style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface)' }}>
            Unique
          </span>
        </label>

        {/* Default value */}
        <div>
          <label style={formLabelStyle} htmlFor={`default-${fieldId}`}>Default Value</label>
          <input
            id={`default-${fieldId}`}
            type="text"
            data-part="default-value-input"
            style={inputStyle}
            value={defaultValue}
            placeholder="Default value..."
            onChange={(e) => setDefaultValue(e.target.value)}
            onBlur={handleDefaultValueBlur}
          />
        </div>

        {/* Type-specific: Select / Multi-Select options */}
        {isSelectType && (
          <div style={sectionDividerStyle}>
            <label style={formLabelStyle}>Options</label>
            <SelectOptionsEditor
              options={selectOptions}
              onChange={handleSelectOptionsChange}
            />
          </div>
        )}

        {/* Follow-up stubs for other field type configs */}
        {!isSelectType && field.type === 'relation' && (
          <div style={sectionDividerStyle}>
            <span style={{ ...formLabelStyle, opacity: 0.5 }}>Relation target</span>
            <p style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)', margin: 0 }}>
              Concept picker — follow-up task: MAG-relation-picker
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SchemaFieldsEditor ────────────────────────────────────────────────────────

export const SchemaFieldsEditor: React.FC<SchemaFieldsEditorProps> = ({
  schemaId,
  onFieldSelect,
  mode = 'edit',
  context,
}) => {
  const invoke = useKernelInvoke();
  const isCreate = mode === 'create';

  // Load fields from kernel (skipped in create mode — field list starts empty)
  const { data: rawFields, loading, error, refetch } = useConceptQuery<FieldRow[]>(
    isCreate ? '__none__' : 'FieldDefinition',
    isCreate ? '__none__' : 'list',
    isCreate ? {} : { schema: schemaId },
  );

  // In create mode, start with an empty field list
  const [fields, setFields] = useState<FieldRow[]>(isCreate ? [] : []);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState({ top: 0, left: 0 });
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');

  // Config panel state: which field's gear panel is open
  const [configPanelFieldId, setConfigPanelFieldId] = useState<string | null>(null);

  const commitLabel = useCallback(async (field: FieldRow) => {
    const newLabel = editingLabelValue.trim();
    setEditingLabelId(null);
    if (!newLabel || newLabel === field.label) return;
    try {
      const result = await invoke('FieldDefinition', 'rename', {
        schema: schemaId,
        fieldId: field.fieldId ?? field.id,
        newLabel,
      });
      if (result.variant === 'ok') refetch();
      else setActionError((result.message as string | undefined) ?? 'Failed to rename field.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to rename field.');
    }
  }, [editingLabelValue, invoke, schemaId, refetch]);

  // Drag state
  const dragIndexRef = useRef<number>(-1);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);

  // Sync fields from query result
  useEffect(() => {
    if (rawFields) {
      const sorted = [...rawFields].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      setFields(sorted);
    }
  }, [rawFields]);

  // ── Add field ──────────────────────────────────────────────────────────────

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTypePickerPos({ top: rect.top - 8, left: rect.right + 8 });
    setTypePickerOpen(true);
  }, []);

  const handleTypeSelect = useCallback(async (type: string) => {
    setTypePickerOpen(false);
    setActionError(null);
    setActionPending(true);
    const label = `New ${FIELD_TYPE_REGISTRY[type]?.label ?? type} field`;
    const fieldId = `${type}_${Date.now().toString(36)}`;
    try {
      const result = await invoke('FieldDefinition', 'create', {
        schema: schemaId,
        fieldId,
        label,
        fieldType: type,
        required: false,
        unique: false,
      });
      if (result.variant === 'ok') {
        refetch();
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to add field.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add field.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, schemaId, refetch]);

  // ── Remove field ───────────────────────────────────────────────────────────

  const handleRemoveClick = useCallback(async (fieldId: string, fieldLabel: string) => {
    if (pendingDeleteId !== fieldId) {
      const usageResult = await invoke('SchemaUsage', 'check', {
        schema: schemaId,
        field: fieldId,
      });
      if (usageResult.variant === 'ok' && (usageResult.count as number) > 0) {
        setDeleteWarning(
          `"${fieldLabel}" is used in ${usageResult.count} record(s). Deleting will remove those values.`,
        );
        setPendingDeleteId(fieldId);
        return;
      }
    }
    setDeleteWarning(null);
    setPendingDeleteId(null);
    setActionError(null);
    setActionPending(true);
    try {
      const result = await invoke('FieldDefinition', 'remove', { field: fieldId, schema: schemaId });
      if (result.variant === 'ok') {
        // Close config panel if this field's panel was open
        if (configPanelFieldId === fieldId) setConfigPanelFieldId(null);
        refetch();
      } else {
        setActionError((result.message as string | undefined) ?? 'Failed to remove field.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove field.');
    } finally {
      setActionPending(false);
    }
  }, [invoke, schemaId, pendingDeleteId, refetch, configPanelFieldId]);

  const cancelDelete = useCallback(() => {
    setDeleteWarning(null);
    setPendingDeleteId(null);
  }, []);

  // ── Drag to reorder ────────────────────────────────────────────────────────

  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(async (targetIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex < 0 || fromIndex === targetIndex) {
      setDragOverIndex(-1);
      return;
    }
    const reordered = [...fields];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setFields(reordered);
    setDragOverIndex(-1);
    dragIndexRef.current = -1;

    const ids = reordered.map((f) => f.id);
    setActionError(null);
    try {
      const result = await invoke('FieldDefinition', 'reorder', { schema: schemaId, fields: ids });
      if (result.variant !== 'ok') {
        setActionError((result.message as string | undefined) ?? 'Failed to reorder fields.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reorder fields.');
    }
  }, [fields, invoke, schemaId]);

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(-1);
    dragIndexRef.current = -1;
  }, []);

  // ── Gear / config panel ────────────────────────────────────────────────────

  const handleGearClick = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setConfigPanelFieldId(prev => prev === fieldId ? null : fieldId);
    onFieldSelect?.(fieldId);
  }, [onFieldSelect]);

  const handleConfigPanelClose = useCallback(() => {
    setConfigPanelFieldId(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isCreate && loading) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
        Loading fields...
      </div>
    );
  }

  if (!isCreate && error) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--palette-error)', fontSize: 'var(--typography-body-sm-size)' }}>
        Failed to load fields: {error}
      </div>
    );
  }

  return (
    <div data-part="root" data-state={configPanelFieldId ? 'config-open' : 'idle'} style={containerStyle}>
      {/* Header */}
      <div data-part="header" style={headerStyle}>
        <span style={{
          fontSize: 'var(--typography-label-md-size)',
          fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
          color: 'var(--palette-on-surface)',
        }}>
          {isCreate ? 'New Schema Fields' : 'Fields'}
        </span>
        <span style={{
          fontSize: 'var(--typography-body-sm-size)',
          color: 'var(--palette-on-surface-variant)',
        }}>
          {fields.length} {fields.length === 1 ? 'field' : 'fields'}
        </span>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div style={{
          padding: 'var(--spacing-xs) var(--spacing-md)',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          fontSize: 'var(--typography-body-sm-size)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--spacing-sm)',
        }} data-part="action-error">
          <span>{actionError}</span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, padding: '2px 4px' }}
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Delete warning banner */}
      {deleteWarning && (
        <div style={warningStyle} data-part="delete-warning">
          <div style={{ marginBottom: 4 }}>{deleteWarning}</div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              type="button"
              style={{
                padding: '2px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--palette-error)',
                background: 'var(--palette-error)',
                color: 'var(--palette-on-error)',
                cursor: 'pointer',
                fontSize: 'var(--typography-body-sm-size)',
                fontFamily: 'inherit',
              }}
              onClick={() => {
                if (pendingDeleteId) handleRemoveClick(pendingDeleteId, '');
              }}
            >
              Delete anyway
            </button>
            <button
              type="button"
              style={{
                padding: '2px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--palette-outline)',
                background: 'none',
                color: 'var(--palette-on-surface)',
                cursor: 'pointer',
                fontSize: 'var(--typography-body-sm-size)',
                fontFamily: 'inherit',
              }}
              onClick={cancelDelete}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Field list */}
      <div data-part="field-list" style={fieldListStyle} role="list" aria-label="Schema fields">
        {fields.length === 0 && (
          <div style={{
            padding: 'var(--spacing-lg) var(--spacing-md)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: 'var(--typography-body-sm-size)',
            textAlign: 'center',
          }}>
            No fields defined. Add a field to get started.
          </div>
        )}

        {fields.map((field, index) => {
          const typeCfg = FIELD_TYPE_REGISTRY[field.type];
          const isDragOver = dragOverIndex === index;
          const isConfigOpen = configPanelFieldId === field.id;
          return (
            <div
              key={field.id}
              data-part="field-row"
              data-field-id={field.id}
              role="listitem"
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              style={{
                ...fieldRowBaseStyle,
                position: 'relative',
                background: isDragOver
                  ? 'var(--palette-primary-container)'
                  : field.id === pendingDeleteId
                    ? 'var(--palette-error-container)'
                    : isConfigOpen
                      ? 'var(--palette-surface-variant)'
                      : 'var(--palette-surface)',
                borderTop: isDragOver ? '2px solid var(--palette-primary)' : undefined,
              }}
              onClick={() => onFieldSelect?.(field.id)}
            >
              {/* Drag handle */}
              <span
                data-part="drag-handle"
                style={dragHandleStyle}
                aria-label="Drag to reorder"
                onClick={(e) => e.stopPropagation()}
              >
                ⠿
              </span>

              {/* Type icon */}
              <span data-part="type-icon" style={typeIconStyle} title={typeCfg?.label ?? field.type}>
                {typeCfg?.icon ?? field.type.charAt(0).toUpperCase()}
              </span>

              {/* Label — click to edit */}
              {editingLabelId === field.id ? (
                <input
                  data-part="field-label-input"
                  autoFocus
                  value={editingLabelValue}
                  onChange={(e) => setEditingLabelValue(e.target.value)}
                  onBlur={() => commitLabel(field)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLabel(field);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingLabelId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...fieldLabelStyle, border: '1px solid var(--palette-primary)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', fontFamily: 'inherit' }}
                />
              ) : (
                <span
                  data-part="field-label"
                  style={{ ...fieldLabelStyle, cursor: 'text' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLabelId(field.id);
                    setEditingLabelValue(field.label);
                  }}
                  title="Click to rename"
                >
                  {field.label}
                </span>
              )}

              {/* Type badge */}
              <span data-part="type-badge" style={typeBadgeStyle}>
                {typeCfg?.label ?? field.type}
              </span>

              {/* Required indicator */}
              <span
                data-part="required-indicator"
                style={indicatorStyle(!!field.required)}
                title={field.required ? 'Required' : 'Not required'}
              >
                R
              </span>

              {/* Unique indicator */}
              <span
                data-part="unique-indicator"
                style={indicatorStyle(!!field.unique)}
                title={field.unique ? 'Unique' : 'Not unique'}
              >
                U
              </span>

              {/* Gear icon — opens config panel */}
              <button
                type="button"
                data-part="configure-button"
                data-config-open={isConfigOpen ? 'true' : 'false'}
                style={isConfigOpen ? gearBtnActiveStyle : gearBtnStyle}
                aria-label={`Configure ${field.label}`}
                aria-expanded={isConfigOpen ? 'true' : 'false'}
                onClick={(e) => handleGearClick(e, field.id)}
              >
                ⚙
              </button>

              {/* Remove button */}
              <button
                type="button"
                data-part="remove-button"
                style={removeBtnStyle}
                aria-label={`Remove ${field.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveClick(field.id, field.label);
                }}
              >
                ×
              </button>

              {/* Inline config panel — floats right of row */}
              {isConfigOpen && (
                <FieldConfigPanel
                  field={field}
                  schemaId={schemaId}
                  onClose={handleConfigPanelClose}
                  onUpdated={refetch}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add field button */}
      <button
        type="button"
        data-part="add-field-button"
        style={addBtnStyle}
        onClick={handleAddClick}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
        <span>Add field</span>
      </button>

      {/* Inline type picker */}
      {typePickerOpen && (
        <FieldTypePicker
          anchorPos={typePickerPos}
          onSelect={handleTypeSelect}
          onClose={() => setTypePickerOpen(false)}
        />
      )}
    </div>
  );
};

export default SchemaFieldsEditor;
