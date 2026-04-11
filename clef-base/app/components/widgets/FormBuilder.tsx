'use client';

/**
 * FormBuilder — visual form design surface for Clef Base.
 *
 * Three-column layout:
 *   Left:   Field palette — available schema fields grouped by type
 *   Center: Canvas — the form layout being designed (groups, steps, fields)
 *   Right:  Config panel — settings for the selected field or group
 *
 * Provides: field group management, step management, conditional visibility
 * editor, live preview, and auto-save via FormSpec/update.
 *
 * See architecture doc Section 10.1 for content-native schema patterns.
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import type {
  FormSpec,
  FormGroup,
  FormStep,
  FieldDefinition,
} from './FormRenderer';
import { FormRenderer } from './FormRenderer';
import { FIELD_TYPE_REGISTRY } from './FieldWidget';
import type { ConditionOperator } from '../../../lib/form-conditions';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormBuilderProps {
  schemaId: string;
  /** If editing an existing FormSpec by name, or "default" for new. */
  formName?: string;
}

type SelectionTarget =
  | { kind: 'field'; fieldId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'step'; stepId: string }
  | null;

type DragSubject =
  | { kind: 'palette-field'; fieldId: string }
  | { kind: 'canvas-field'; fieldId: string; sourceGroupId: string | null }
  | null;

const GROUP_TYPES: FormGroup['type'][] = [
  'section',
  'fieldset',
  'accordion',
  'columns',
  'tab',
];

const GROUP_TYPE_LABELS: Record<FormGroup['type'], string> = {
  section: 'Section',
  fieldset: 'Fieldset',
  accordion: 'Accordion',
  columns: 'Columns',
  tab: 'Tab',
};

const CONDITION_OPERATORS: ConditionOperator[] = [
  'equals',
  'not-equals',
  'contains',
  'is-empty',
  'is-not-empty',
  'any-of',
  'greater-than',
  'less-than',
];

// ─── Unique ID helpers ────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const colHeaderStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  borderBottom: '1px solid var(--palette-outline)',
  fontSize: 'var(--typography-label-sm-size)',
  fontWeight: 'var(--typography-label-md-weight)',
  color: 'var(--palette-on-surface-variant)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  userSelect: 'none',
};

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: 'var(--palette-surface)',
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 'var(--spacing-md)',
};

const fieldPillStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-xs)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface-variant)',
  border: '1px solid var(--palette-outline)',
  cursor: 'grab',
  fontSize: 'var(--typography-label-sm-size)',
  color: 'var(--palette-on-surface)',
  userSelect: 'none',
  marginBottom: '4px',
};

const fieldPillSelectedStyle: React.CSSProperties = {
  ...fieldPillStyle,
  background: 'var(--palette-primary-container)',
  borderColor: 'var(--palette-primary)',
  color: 'var(--palette-on-primary-container)',
};

const groupCardStyle: React.CSSProperties = {
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  marginBottom: 'var(--spacing-md)',
  background: 'var(--palette-surface)',
  overflow: 'hidden',
};

const groupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  background: 'var(--palette-surface-variant)',
  borderBottom: '1px solid var(--palette-outline)',
  cursor: 'pointer',
  userSelect: 'none',
};

const dropZoneStyle: React.CSSProperties = {
  minHeight: 48,
  padding: 'var(--spacing-sm)',
  border: '2px dashed var(--palette-outline-variant)',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const dropZoneActiveStyle: React.CSSProperties = {
  ...dropZoneStyle,
  borderColor: 'var(--palette-primary)',
  background: 'var(--palette-primary-container)',
  opacity: 0.8,
};

const configLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--typography-label-sm-size)',
  fontWeight: 'var(--typography-label-md-weight)',
  color: 'var(--palette-on-surface-variant)',
  marginBottom: '4px',
};

const configInputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--palette-outline)',
  background: 'var(--palette-surface-variant)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--palette-on-surface-variant)',
  fontSize: '14px',
  lineHeight: 1,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-sm-size)',
  fontWeight: 'var(--typography-label-md-weight)',
  color: 'var(--palette-on-surface)',
  padding: 'var(--spacing-sm) 0',
  marginBottom: 'var(--spacing-xs)',
  borderBottom: '1px solid var(--palette-outline-variant)',
};

// ─── FieldTypeIcon ─────────────────────────────────────────────────────────────

const FieldTypeIcon: React.FC<{ type?: string }> = ({ type }) => {
  const cfg = type ? FIELD_TYPE_REGISTRY[type] : undefined;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '3px',
        background: 'var(--palette-primary-container)',
        color: 'var(--palette-on-primary-container)',
        fontSize: '10px',
        fontWeight: 'bold',
        flexShrink: 0,
      }}
      title={cfg?.label ?? type}
    >
      {cfg?.icon ?? (type?.charAt(0).toUpperCase() ?? '?')}
    </span>
  );
};

// ─── FieldPalette ─────────────────────────────────────────────────────────────

interface FieldPaletteProps {
  fieldDefs: FieldDefinition[];
  usedFieldIds: Set<string>;
  onDragStart: (fieldId: string) => void;
  onAddField: (fieldId: string) => void;
}

const FieldPalette: React.FC<FieldPaletteProps> = ({
  fieldDefs,
  usedFieldIds,
  onDragStart,
  onAddField,
}) => {
  // Group fields by FIELD_TYPE_REGISTRY group
  const byGroup = useMemo(() => {
    const groups: Record<string, FieldDefinition[]> = {};
    for (const def of fieldDefs) {
      const g = FIELD_TYPE_REGISTRY[def.type ?? '']?.group ?? 'special';
      if (!groups[g]) groups[g] = [];
      groups[g].push(def);
    }
    return groups;
  }, [fieldDefs]);

  const groupLabels: Record<string, string> = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    choice: 'Choice',
    reference: 'Reference',
    special: 'Special',
  };

  return (
    <div style={panelStyle} data-part="field-palette">
      <div style={colHeaderStyle}>Fields</div>
      <div style={scrollAreaStyle}>
        {Object.entries(byGroup).map(([group, defs]) => (
          <div key={group} style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={sectionTitleStyle}>{groupLabels[group] ?? group}</div>
            {defs.map((def) => {
              const used = usedFieldIds.has(def.id);
              return (
                <div
                  key={def.id}
                  style={used ? { ...fieldPillStyle, opacity: 0.4, cursor: 'default' } : fieldPillStyle}
                  draggable={!used}
                  onDragStart={() => !used && onDragStart(def.id)}
                  onClick={() => !used && onAddField(def.id)}
                  data-part="palette-field"
                  data-field-id={def.id}
                  data-state={used ? 'used' : 'available'}
                  title={used ? 'Already in form' : `Click or drag to add ${def.label ?? def.id}`}
                >
                  <FieldTypeIcon type={def.type} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {def.label ?? def.id}
                  </span>
                  {def.required && (
                    <span style={{ color: 'var(--palette-error)', fontSize: '10px' }}>*</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {fieldDefs.length === 0 && (
          <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)', textAlign: 'center', paddingTop: 'var(--spacing-xl)' }}>
            No fields found for this schema.
          </div>
        )}
      </div>
    </div>
  );
};

// ─── CanvasFieldRow ────────────────────────────────────────────────────────────

interface CanvasFieldRowProps {
  def: FieldDefinition;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: (fieldId: string, groupId: string | null) => void;
  groupId: string | null;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}

const CanvasFieldRow: React.FC<CanvasFieldRowProps> = ({
  def,
  selected,
  onSelect,
  onRemove,
  onDragStart,
  groupId,
  isDragOver,
  onDragOver,
  onDrop,
  onDragLeave,
}) => {
  const style: React.CSSProperties = selected ? fieldPillSelectedStyle : fieldPillStyle;
  return (
    <div
      style={{
        ...style,
        justifyContent: 'space-between',
        background: isDragOver ? 'var(--palette-primary-container)' : (selected ? 'var(--palette-primary-container)' : 'var(--palette-surface-variant)'),
        borderColor: isDragOver ? 'var(--palette-primary)' : (selected ? 'var(--palette-primary)' : 'var(--palette-outline)'),
        transition: 'background 0.1s, border-color 0.1s',
      }}
      draggable
      onDragStart={() => onDragStart(def.id, groupId)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onClick={onSelect}
      data-part="canvas-field"
      data-field-id={def.id}
      data-state={selected ? 'selected' : 'default'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flex: 1, minWidth: 0 }}>
        <span style={{ cursor: 'grab', color: 'var(--palette-on-surface-variant)', fontSize: '12px' }}>⠿</span>
        <FieldTypeIcon type={def.type} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {def.label ?? def.id}
        </span>
        {def.required && (
          <span style={{ color: 'var(--palette-error)', fontSize: '10px' }}>*</span>
        )}
      </div>
      <button
        type="button"
        style={iconBtnStyle}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove field from form"
        aria-label={`Remove ${def.label ?? def.id}`}
      >
        ×
      </button>
    </div>
  );
};

// ─── CanvasGroupCard ───────────────────────────────────────────────────────────

interface CanvasGroupCardProps {
  group: FormGroup;
  fieldDefs: Map<string, FieldDefinition>;
  selected: boolean;
  selectedFieldId: string | null;
  onSelectGroup: () => void;
  onSelectField: (fieldId: string) => void;
  onRemoveGroup: () => void;
  onRemoveField: (fieldId: string) => void;
  onDropField: (groupId: string, fieldId: string) => void;
  onDragStart: (fieldId: string, groupId: string | null) => void;
  dragSubject: DragSubject;
}

const CanvasGroupCard: React.FC<CanvasGroupCardProps> = ({
  group,
  fieldDefs,
  selected,
  selectedFieldId,
  onSelectGroup,
  onSelectField,
  onRemoveGroup,
  onRemoveField,
  onDropField,
  onDragStart,
  dragSubject,
}) => {
  const [dropTarget, setDropTarget] = useState<string | null>(null); // fieldId being hovered or 'zone'

  const handleZoneDragOver = (e: React.DragEvent) => {
    if (dragSubject) { e.preventDefault(); setDropTarget('zone'); }
  };
  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    if (!dragSubject) return;
    const fid = dragSubject.kind === 'palette-field' ? dragSubject.fieldId : dragSubject.fieldId;
    onDropField(group.id, fid);
  };

  return (
    <div
      style={{
        ...groupCardStyle,
        borderColor: selected ? 'var(--palette-primary)' : 'var(--palette-outline)',
        boxShadow: selected ? `0 0 0 2px var(--palette-primary)` : undefined,
      }}
      data-part="canvas-group"
      data-group-id={group.id}
      data-state={selected ? 'selected' : 'default'}
    >
      <div
        style={groupHeaderStyle}
        onClick={onSelectGroup}
        data-part="group-header"
      >
        <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: '12px', cursor: 'grab' }}>⠿</span>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            borderRadius: '10px',
            background: 'var(--palette-secondary-container)',
            color: 'var(--palette-on-secondary-container)',
          }}
        >
          {GROUP_TYPE_LABELS[group.type]}
        </span>
        <span style={{ flex: 1, fontSize: 'var(--typography-label-sm-size)', color: 'var(--palette-on-surface)' }}>
          {group.label ?? group.id}
        </span>
        <button
          type="button"
          style={iconBtnStyle}
          onClick={(e) => { e.stopPropagation(); onRemoveGroup(); }}
          title="Remove group"
          aria-label="Remove group"
        >
          ×
        </button>
      </div>

      <div
        style={dropTarget === 'zone' ? dropZoneActiveStyle : dropZoneStyle}
        onDragOver={handleZoneDragOver}
        onDrop={handleZoneDrop}
        onDragLeave={() => setDropTarget(null)}
        data-part="drop-zone"
      >
        {group.fieldIds.length === 0 && (
          <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-label-sm-size)', textAlign: 'center', padding: 'var(--spacing-sm)' }}>
            Drop fields here
          </div>
        )}
        {group.fieldIds.map((fid) => {
          const def = fieldDefs.get(fid);
          if (!def) return null;
          return (
            <CanvasFieldRow
              key={fid}
              def={def}
              selected={selectedFieldId === fid}
              onSelect={() => onSelectField(fid)}
              onRemove={() => onRemoveField(fid)}
              onDragStart={onDragStart}
              groupId={group.id}
              isDragOver={dropTarget === fid}
              onDragOver={(e) => { if (dragSubject) { e.preventDefault(); setDropTarget(fid); } }}
              onDrop={(e) => { e.stopPropagation(); e.preventDefault(); setDropTarget(null); if (dragSubject) onDropField(group.id, dragSubject.fieldId); }}
              onDragLeave={() => setDropTarget(null)}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── StepManager ──────────────────────────────────────────────────────────────

interface StepManagerProps {
  steps: FormStep[];
  groups: FormGroup[];
  onAddStep: () => void;
  onRemoveStep: (stepId: string) => void;
  onRenameStep: (stepId: string, label: string) => void;
  onToggleGroupInStep: (stepId: string, groupId: string) => void;
}

const StepManager: React.FC<StepManagerProps> = ({
  steps,
  groups,
  onAddStep,
  onRemoveStep,
  onRenameStep,
  onToggleGroupInStep,
}) => {
  return (
    <div style={{ marginBottom: 'var(--spacing-lg)' }} data-part="step-manager">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <div style={sectionTitleStyle}>Steps</div>
        <button
          type="button"
          style={{ ...iconBtnStyle, color: 'var(--palette-primary)', fontSize: '13px' }}
          onClick={onAddStep}
          title="Add step"
        >
          + Add Step
        </button>
      </div>

      {steps.length === 0 && (
        <div style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
          No steps — form renders as a single page.
        </div>
      )}

      {steps.map((step) => (
        <div
          key={step.id}
          style={{ border: '1px solid var(--palette-outline)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}
          data-part="step-row"
          data-step-id={step.id}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
            <input
              type="text"
              style={{ ...configInputStyle, flex: 1 }}
              value={step.label}
              onChange={(e) => onRenameStep(step.id, e.target.value)}
              placeholder="Step label"
              aria-label="Step label"
            />
            <button
              type="button"
              style={iconBtnStyle}
              onClick={() => onRemoveStep(step.id)}
              title="Remove step"
              aria-label="Remove step"
            >
              ×
            </button>
          </div>
          {groups.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {groups.map((g) => {
                const included = step.groupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onToggleGroupInStep(step.id, g.id)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: `1px solid ${included ? 'var(--palette-primary)' : 'var(--palette-outline)'}`,
                      background: included ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                      color: included ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface-variant)',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                    data-state={included ? 'included' : 'excluded'}
                  >
                    {g.label ?? g.id}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── ConditionEditor ───────────────────────────────────────────────────────────

interface ConditionEditorProps {
  fieldId: string;
  fieldDefs: FieldDefinition[];
  conditionsJson: string | undefined;
  onChange: (json: string) => void;
}

interface SimpleCondition {
  fieldId: string;
  showWhen: { field: string; operator: ConditionOperator; value?: unknown };
}

const ConditionEditor: React.FC<ConditionEditorProps> = ({
  fieldId,
  fieldDefs,
  conditionsJson,
  onChange,
}) => {
  // Parse existing condition for this field from the JSON
  const parsed: SimpleCondition[] = useMemo(() => {
    if (!conditionsJson) return [];
    try { return JSON.parse(conditionsJson) as SimpleCondition[]; } catch { return []; }
  }, [conditionsJson]);

  const myCondition = parsed.find((c) => c.fieldId === fieldId);

  const otherFields = fieldDefs.filter((d) => d.id !== fieldId);

  const [enabled, setEnabled] = useState(!!myCondition);
  const [watchField, setWatchField] = useState(myCondition?.showWhen.field ?? '');
  const [operator, setOperator] = useState<ConditionOperator>(
    myCondition?.showWhen.operator ?? 'equals',
  );
  const [value, setValue] = useState(
    myCondition?.showWhen.value !== undefined ? String(myCondition.showWhen.value) : '',
  );

  // Emit updated JSON whenever fields change
  useEffect(() => {
    if (!enabled || !watchField) {
      // Remove condition for this field
      const remaining = parsed.filter((c) => c.fieldId !== fieldId);
      onChange(remaining.length ? JSON.stringify(remaining) : '');
      return;
    }
    const newCondition: SimpleCondition = {
      fieldId,
      showWhen: { field: watchField, operator, ...(value ? { value } : {}) },
    };
    const others = parsed.filter((c) => c.fieldId !== fieldId);
    onChange(JSON.stringify([...others, newCondition]));
  }, [enabled, watchField, operator, value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ marginTop: 'var(--spacing-sm)' }} data-part="condition-editor">
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer', marginBottom: 'var(--spacing-xs)' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          aria-label="Enable conditional visibility"
        />
        <span style={{ fontSize: 'var(--typography-label-sm-size)', color: 'var(--palette-on-surface)' }}>
          Show only when
        </span>
      </label>

      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', paddingLeft: 'var(--spacing-md)' }}>
          <select
            style={configInputStyle}
            value={watchField}
            onChange={(e) => setWatchField(e.target.value)}
            aria-label="Watch field"
          >
            <option value="">Select field...</option>
            {otherFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label ?? f.id}</option>
            ))}
          </select>

          <select
            style={configInputStyle}
            value={operator}
            onChange={(e) => setOperator(e.target.value as ConditionOperator)}
            aria-label="Condition operator"
          >
            {CONDITION_OPERATORS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          {operator !== 'is-empty' && operator !== 'is-not-empty' && (
            <input
              type="text"
              style={configInputStyle}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value..."
              aria-label="Condition value"
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── ConfigPanel ───────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  selection: SelectionTarget;
  formSpec: FormSpec;
  fieldDefs: Map<string, FieldDefinition>;
  allFieldDefs: FieldDefinition[];
  onUpdateGroup: (groupId: string, patch: Partial<FormGroup>) => void;
  onUpdateFieldCondition: (fieldId: string, conditionsJson: string) => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  selection,
  formSpec,
  fieldDefs,
  allFieldDefs,
  onUpdateGroup,
  onUpdateFieldCondition,
}) => {
  if (!selection) {
    return (
      <div style={panelStyle} data-part="config-panel">
        <div style={colHeaderStyle}>Config</div>
        <div style={{ ...scrollAreaStyle, color: 'var(--palette-on-surface-variant)', textAlign: 'center', paddingTop: 'var(--spacing-xl)', fontSize: 'var(--typography-body-sm-size)' }}>
          Select a field or group to configure it.
        </div>
      </div>
    );
  }

  if (selection.kind === 'field') {
    const def = fieldDefs.get(selection.fieldId);
    if (!def) return null;

    return (
      <div style={panelStyle} data-part="config-panel" data-selection="field">
        <div style={colHeaderStyle}>Field Config</div>
        <div style={scrollAreaStyle}>
          <div style={sectionTitleStyle}>
            <FieldTypeIcon type={def.type} /> {def.label ?? def.id}
          </div>

          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={configLabelStyle}>Type</label>
              <div style={{ ...configInputStyle, background: 'var(--palette-surface)', cursor: 'default', color: 'var(--palette-on-surface-variant)' }}>
                {FIELD_TYPE_REGISTRY[def.type ?? '']?.label ?? def.type ?? 'Unknown'}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={configLabelStyle}>ID</label>
              <div style={{ ...configInputStyle, background: 'var(--palette-surface)', cursor: 'default', color: 'var(--palette-on-surface-variant)', fontFamily: 'monospace' }}>
                {def.id}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={configLabelStyle}>Required</label>
              <div style={{ fontSize: 'var(--typography-body-sm-size)', color: def.required ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)' }}>
                {def.required ? 'Yes' : 'No'}
              </div>
            </div>

            {def.helpText && (
              <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label style={configLabelStyle}>Help Text</label>
                <div style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface)' }}>
                  {def.helpText}
                </div>
              </div>
            )}
          </div>

          <div style={sectionTitleStyle}>Conditional Visibility</div>
          <ConditionEditor
            fieldId={def.id}
            fieldDefs={allFieldDefs}
            conditionsJson={formSpec.conditions}
            onChange={(json) => onUpdateFieldCondition(def.id, json)}
          />
        </div>
      </div>
    );
  }

  if (selection.kind === 'group') {
    const group = formSpec.groups?.find((g) => g.id === selection.groupId);
    if (!group) return null;

    return (
      <div style={panelStyle} data-part="config-panel" data-selection="group">
        <div style={colHeaderStyle}>Group Config</div>
        <div style={scrollAreaStyle}>
          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
            <label style={configLabelStyle}>Label</label>
            <input
              type="text"
              style={configInputStyle}
              value={group.label ?? ''}
              onChange={(e) => onUpdateGroup(group.id, { label: e.target.value })}
              placeholder="Group label..."
              aria-label="Group label"
            />
          </div>

          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
            <label style={configLabelStyle}>Type</label>
            <select
              style={configInputStyle}
              value={group.type}
              onChange={(e) => onUpdateGroup(group.id, { type: e.target.value as FormGroup['type'] })}
              aria-label="Group type"
            >
              {GROUP_TYPES.map((t) => (
                <option key={t} value={t}>{GROUP_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {group.type === 'columns' && (
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={configLabelStyle}>Column Count</label>
              <input
                type="number"
                style={configInputStyle}
                value={group.columnCount ?? 2}
                min={1}
                max={6}
                onChange={(e) => onUpdateGroup(group.id, { columnCount: Math.max(1, parseInt(e.target.value, 10) || 2) })}
                aria-label="Column count"
              />
            </div>
          )}

          {group.type === 'accordion' && (
            <div style={{ marginBottom: 'var(--spacing-sm)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={group.collapsed ?? false}
                  onChange={(e) => onUpdateGroup(group.id, { collapsed: e.target.checked })}
                  aria-label="Collapsed by default"
                />
                <span style={configLabelStyle}>Collapsed by default</span>
              </label>
            </div>
          )}

          <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-label-sm-size)' }}>
            {group.fieldIds.length} field{group.fieldIds.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ─── FormBuilder ──────────────────────────────────────────────────────────────

export const FormBuilder: React.FC<FormBuilderProps> = ({
  schemaId,
  formName = 'default',
}) => {
  const invoke = useKernelInvoke();

  // ── Loading ──
  const [formSpec, setFormSpec] = useState<FormSpec | null>(null);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // ── UI state ──
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [dragSubject, setDragSubject] = useState<DragSubject>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ── Save state ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const specResult = await invoke('FormSpec', 'resolve', {
          schemaId,
          mode: 'create',
          name: formName,
        });

        const defsResult = await invoke('FieldDefinition', 'list', { schemaId });
        const defs: FieldDefinition[] =
          defsResult.variant === 'ok'
            ? (typeof defsResult.items === 'string'
                ? (JSON.parse(defsResult.items) as FieldDefinition[])
                : (defsResult.items as FieldDefinition[]))
            : [];

        defs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        if (!cancelled) {
          if (specResult.variant === 'ok') {
            setFormSpec(specResult.spec as FormSpec);
          } else {
            // No existing FormSpec — will offer to create one
            setFormSpec(null);
          }
          setFieldDefs(defs);
          setInitialized(true);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [schemaId, formName, invoke]);

  // ── Derived ──
  const fieldDefMap = useMemo(
    () => new Map<string, FieldDefinition>(fieldDefs.map((d) => [d.id, d])),
    [fieldDefs],
  );

  const usedFieldIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of formSpec?.groups ?? []) {
      for (const fid of g.fieldIds) s.add(fid);
    }
    return s;
  }, [formSpec]);

  // ── Auto-save ──
  const scheduleSave = useCallback((spec: FormSpec) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const result = await invoke('FormSpec', 'update', {
          schemaId,
          name: formName,
          spec,
        });
        if (result.variant !== 'ok') {
          setSaveError((result.message as string | undefined) ?? 'Save failed');
        } else {
          setLastSaved(new Date());
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, [invoke, schemaId, formName]);

  const updateFormSpec = useCallback((updater: (prev: FormSpec) => FormSpec) => {
    setFormSpec((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  // ── Initialize (create default FormSpec) ──
  const handleCreateFormSpec = useCallback(async () => {
    const newSpec: FormSpec = {
      name: formName,
      schemaId,
      mode: 'create',
      groups: [],
      steps: [],
    };
    setSaving(true);
    try {
      const result = await invoke('FormSpec', 'create', {
        schemaId,
        name: formName,
        spec: newSpec,
      });
      if (result.variant === 'ok') {
        setFormSpec(newSpec);
        setLastSaved(new Date());
      } else {
        setSaveError((result.message as string | undefined) ?? 'Create failed');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }, [invoke, schemaId, formName]);

  // ── Group management ──
  const handleAddGroup = useCallback((type: FormGroup['type'] = 'section') => {
    const id = nextId('group');
    const newGroup: FormGroup = {
      id,
      label: `New ${GROUP_TYPE_LABELS[type]}`,
      type,
      fieldIds: [],
    };
    updateFormSpec((prev) => ({
      ...prev,
      groups: [...(prev.groups ?? []), newGroup],
    }));
    setSelection({ kind: 'group', groupId: id });
  }, [updateFormSpec]);

  const handleRemoveGroup = useCallback((groupId: string) => {
    updateFormSpec((prev) => ({
      ...prev,
      groups: (prev.groups ?? []).filter((g) => g.id !== groupId),
      steps: (prev.steps ?? []).map((s) => ({
        ...s,
        groupIds: s.groupIds.filter((gid) => gid !== groupId),
      })),
    }));
    if (selection?.kind === 'group' && selection.groupId === groupId) {
      setSelection(null);
    }
  }, [updateFormSpec, selection]);

  const handleUpdateGroup = useCallback((groupId: string, patch: Partial<FormGroup>) => {
    updateFormSpec((prev) => ({
      ...prev,
      groups: (prev.groups ?? []).map((g) => g.id === groupId ? { ...g, ...patch } : g),
    }));
  }, [updateFormSpec]);

  const handleRemoveFieldFromGroup = useCallback((groupId: string, fieldId: string) => {
    updateFormSpec((prev) => ({
      ...prev,
      groups: (prev.groups ?? []).map((g) =>
        g.id === groupId ? { ...g, fieldIds: g.fieldIds.filter((id) => id !== fieldId) } : g,
      ),
    }));
    if (selection?.kind === 'field' && selection.fieldId === fieldId) {
      setSelection(null);
    }
  }, [updateFormSpec, selection]);

  // ── Field drop into group ──
  const handleDropField = useCallback((targetGroupId: string, fieldId: string) => {
    updateFormSpec((prev) => {
      // Remove from any existing group
      const groups = (prev.groups ?? []).map((g) => ({
        ...g,
        fieldIds: g.fieldIds.filter((id) => id !== fieldId),
      }));
      // Add to target group if not already present
      const updated = groups.map((g) =>
        g.id === targetGroupId && !g.fieldIds.includes(fieldId)
          ? { ...g, fieldIds: [...g.fieldIds, fieldId] }
          : g,
      );
      return { ...prev, groups: updated };
    });
    setDragSubject(null);
  }, [updateFormSpec]);

  // ── Add field from palette (to first group or ungrouped) ──
  const handleAddFieldFromPalette = useCallback((fieldId: string) => {
    updateFormSpec((prev) => {
      const groups = prev.groups ?? [];
      if (groups.length === 0) {
        // Auto-create a default section group
        const id = nextId('group');
        return {
          ...prev,
          groups: [{
            id,
            label: 'Main',
            type: 'section',
            fieldIds: [fieldId],
          }],
        };
      }
      // Add to last group
      const lastIdx = groups.length - 1;
      return {
        ...prev,
        groups: groups.map((g, i) =>
          i === lastIdx && !g.fieldIds.includes(fieldId)
            ? { ...g, fieldIds: [...g.fieldIds, fieldId] }
            : g,
        ),
      };
    });
  }, [updateFormSpec]);

  // ── Step management ──
  const handleAddStep = useCallback(() => {
    const id = nextId('step');
    const newStep: FormStep = { id, label: 'New Step', groupIds: [] };
    updateFormSpec((prev) => ({
      ...prev,
      steps: [...(prev.steps ?? []), newStep],
    }));
  }, [updateFormSpec]);

  const handleRemoveStep = useCallback((stepId: string) => {
    updateFormSpec((prev) => ({
      ...prev,
      steps: (prev.steps ?? []).filter((s) => s.id !== stepId),
    }));
  }, [updateFormSpec]);

  const handleRenameStep = useCallback((stepId: string, label: string) => {
    updateFormSpec((prev) => ({
      ...prev,
      steps: (prev.steps ?? []).map((s) => s.id === stepId ? { ...s, label } : s),
    }));
  }, [updateFormSpec]);

  const handleToggleGroupInStep = useCallback((stepId: string, groupId: string) => {
    updateFormSpec((prev) => ({
      ...prev,
      steps: (prev.steps ?? []).map((s) => {
        if (s.id !== stepId) return s;
        const has = s.groupIds.includes(groupId);
        return {
          ...s,
          groupIds: has ? s.groupIds.filter((gid) => gid !== groupId) : [...s.groupIds, groupId],
        };
      }),
    }));
  }, [updateFormSpec]);

  // ── Condition editor ──
  const handleUpdateFieldCondition = useCallback((_fieldId: string, conditionsJson: string) => {
    updateFormSpec((prev) => ({ ...prev, conditions: conditionsJson || undefined }));
  }, [updateFormSpec]);

  // ── Drag handlers ──
  const handlePaletteDragStart = useCallback((fieldId: string) => {
    setDragSubject({ kind: 'palette-field', fieldId });
  }, []);

  const handleCanvasDragStart = useCallback((fieldId: string, groupId: string | null) => {
    setDragSubject({ kind: 'canvas-field', fieldId, sourceGroupId: groupId });
  }, []);

  // ── Save button ──
  const handleSave = useCallback(async () => {
    if (!formSpec) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke('FormSpec', 'update', {
        schemaId,
        name: formName,
        spec: formSpec,
      });
      if (result.variant !== 'ok') {
        setSaveError((result.message as string | undefined) ?? 'Save failed');
      } else {
        setLastSaved(new Date());
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [formSpec, invoke, schemaId, formName]);

  // ── Render: loading ──
  if (loading) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--palette-on-surface-variant)' }}
        data-part="form-builder"
        data-state="loading"
      >
        Loading form builder...
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-error)' }}
        data-part="form-builder"
        data-state="error"
      >
        Error: {loadError}
      </div>
    );
  }

  // ── Render: create prompt ──
  if (initialized && !formSpec) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--spacing-md)',
          height: 240,
          color: 'var(--palette-on-surface-variant)',
        }}
        data-part="form-builder"
        data-state="empty"
      >
        <div style={{ fontSize: 'var(--typography-body-lg-size)' }}>No form spec found for "{formName}"</div>
        <button
          type="button"
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--palette-primary)',
            color: 'var(--palette-on-primary)',
            cursor: 'pointer',
            fontSize: 'var(--typography-label-md-size)',
            fontFamily: 'inherit',
          }}
          onClick={handleCreateFormSpec}
          disabled={saving}
        >
          {saving ? 'Creating...' : 'Create Form'}
        </button>
        {saveError && (
          <div style={{ color: 'var(--palette-error)', fontSize: 'var(--typography-body-sm-size)' }}>
            {saveError}
          </div>
        )}
      </div>
    );
  }

  if (!formSpec) return null;

  const selectedFieldId = selection?.kind === 'field' ? selection.fieldId : null;
  const selectedGroupId = selection?.kind === 'group' ? selection.groupId : null;

  // ── Render: builder ──
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--palette-background)',
      }}
      data-part="form-builder"
      data-schema-id={schemaId}
      data-form-name={formName}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderBottom: '1px solid var(--palette-outline)',
          background: 'var(--palette-surface)',
        }}
        data-part="toolbar"
      >
        <span style={{ fontWeight: 'var(--typography-label-md-weight)', color: 'var(--palette-on-surface)' }}>
          Form Builder
        </span>
        <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-label-sm-size)' }}>
          {schemaId} / {formName}
        </span>
        <div style={{ flex: 1 }} />

        {/* Group type quick-add buttons */}
        {GROUP_TYPES.slice(0, 3).map((type) => (
          <button
            key={type}
            type="button"
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--palette-outline)',
              background: 'var(--palette-surface)',
              color: 'var(--palette-on-surface)',
              cursor: 'pointer',
              fontSize: 'var(--typography-label-sm-size)',
              fontFamily: 'inherit',
            }}
            onClick={() => handleAddGroup(type)}
            title={`Add ${GROUP_TYPE_LABELS[type]} group`}
          >
            + {GROUP_TYPE_LABELS[type]}
          </button>
        ))}

        <button
          type="button"
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline)',
            background: showPreview ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
            color: showPreview ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
            cursor: 'pointer',
            fontSize: 'var(--typography-label-sm-size)',
            fontFamily: 'inherit',
          }}
          onClick={() => setShowPreview((p) => !p)}
          data-part="preview-toggle"
          data-state={showPreview ? 'active' : 'inactive'}
        >
          {showPreview ? 'Hide Preview' : 'Preview'}
        </button>

        <button
          type="button"
          style={{
            padding: 'var(--spacing-xs) var(--spacing-md)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--palette-primary)',
            color: 'var(--palette-on-primary)',
            cursor: saving ? 'default' : 'pointer',
            fontSize: 'var(--typography-label-sm-size)',
            fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1,
          }}
          onClick={handleSave}
          disabled={saving}
          data-part="save-button"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>

        {lastSaved && !saving && (
          <span style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)' }}>
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {saveError && (
          <span style={{ fontSize: '11px', color: 'var(--palette-error)' }}>
            {saveError}
          </span>
        )}
      </div>

      {/* Main 3-column workspace (or 2-column with preview) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Field Palette */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid var(--palette-outline)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          data-part="palette-column"
        >
          <FieldPalette
            fieldDefs={fieldDefs}
            usedFieldIds={usedFieldIds}
            onDragStart={handlePaletteDragStart}
            onAddField={handleAddFieldFromPalette}
          />
        </div>

        {/* Center: Canvas */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid var(--palette-outline)',
          }}
          data-part="canvas-column"
          onDragEnd={() => setDragSubject(null)}
        >
          <div style={colHeaderStyle}>Canvas</div>
          <div style={{ ...scrollAreaStyle, display: 'flex', flexDirection: 'column' }}>

            {/* Step manager */}
            {(formSpec.steps?.length ?? 0) > 0 || selection?.kind === 'step' ? (
              <StepManager
                steps={formSpec.steps ?? []}
                groups={formSpec.groups ?? []}
                onAddStep={handleAddStep}
                onRemoveStep={handleRemoveStep}
                onRenameStep={handleRenameStep}
                onToggleGroupInStep={handleToggleGroupInStep}
              />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-sm)' }}>
                <button
                  type="button"
                  style={{ ...iconBtnStyle, color: 'var(--palette-on-surface-variant)', fontSize: '12px' }}
                  onClick={handleAddStep}
                  title="Convert to multi-step wizard"
                >
                  + Add Steps
                </button>
              </div>
            )}

            {/* Groups */}
            {(formSpec.groups?.length ?? 0) === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  gap: 'var(--spacing-md)',
                  color: 'var(--palette-on-surface-variant)',
                  border: '2px dashed var(--palette-outline-variant)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-xl)',
                  minHeight: 200,
                }}
                data-part="empty-canvas"
                onDragOver={(e) => { if (dragSubject?.kind === 'palette-field') e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragSubject?.kind === 'palette-field') handleAddFieldFromPalette(dragSubject.fieldId);
                }}
              >
                <div style={{ fontSize: 'var(--typography-body-md-size)' }}>No groups yet</div>
                <div style={{ fontSize: 'var(--typography-body-sm-size)' }}>
                  Add a group using the toolbar, or drag a field here to auto-create a section.
                </div>
              </div>
            )}

            {(formSpec.groups ?? []).map((group) => (
              <CanvasGroupCard
                key={group.id}
                group={group}
                fieldDefs={fieldDefMap}
                selected={selectedGroupId === group.id}
                selectedFieldId={selectedFieldId}
                onSelectGroup={() => setSelection({ kind: 'group', groupId: group.id })}
                onSelectField={(fid) => setSelection({ kind: 'field', fieldId: fid })}
                onRemoveGroup={() => handleRemoveGroup(group.id)}
                onRemoveField={(fid) => handleRemoveFieldFromGroup(group.id, fid)}
                onDropField={handleDropField}
                onDragStart={handleCanvasDragStart}
                dragSubject={dragSubject}
              />
            ))}
          </div>
        </div>

        {/* Right: Config Panel or Preview */}
        <div
          style={{
            width: showPreview ? 480 : 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          data-part="right-column"
        >
          {showPreview ? (
            <div style={panelStyle} data-part="preview-pane">
              <div style={colHeaderStyle}>Preview</div>
              <div style={{ ...scrollAreaStyle, padding: 'var(--spacing-lg)' }}>
                <FormRenderer
                  schemaId={schemaId}
                  mode={formSpec.mode}
                  formName={formName}
                  onSubmit={async () => {/* preview only */}}
                  compact
                />
              </div>
            </div>
          ) : (
            <ConfigPanel
              selection={selection}
              formSpec={formSpec}
              fieldDefs={fieldDefMap}
              allFieldDefs={fieldDefs}
              onUpdateGroup={handleUpdateGroup}
              onUpdateFieldCondition={handleUpdateFieldCondition}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FormBuilder;
