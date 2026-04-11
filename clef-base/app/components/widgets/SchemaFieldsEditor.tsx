'use client';

/**
 * SchemaFieldsEditor — Level 3 full field list editor for /admin/schemas/:id.
 *
 * Shows all fields in a reorderable list. Each row has:
 *   drag handle | type icon | label | type badge | required indicator | unique indicator | gear
 *
 * Features:
 *   - Add field: opens inline FieldTypePicker
 *   - Remove field: warns if field is in use (SchemaUsage check)
 *   - Reorder via drag-and-drop handles
 *   - Click row to open config panel (onFieldSelect callback)
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
}

// ─── Local types ────────────────────────────────────────────────────────────────

interface FieldRow {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  order?: number;
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

// ─── SchemaFieldsEditor ────────────────────────────────────────────────────────

export const SchemaFieldsEditor: React.FC<SchemaFieldsEditorProps> = ({
  schemaId,
  onFieldSelect,
}) => {
  const invoke = useKernelInvoke();

  // Load fields from kernel
  const { data: rawFields, loading, error, refetch } = useConceptQuery<FieldRow[]>(
    'FieldDefinition', 'list', { schema: schemaId },
  );

  const [fields, setFields] = useState<FieldRow[]>([]);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [typePickerPos, setTypePickerPos] = useState({ top: 0, left: 0 });
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    const label = `New ${FIELD_TYPE_REGISTRY[type]?.label ?? type} field`;
    const result = await invoke('FieldDefinition', 'create', {
      schema: schemaId,
      label,
      type,
      required: false,
      unique: false,
    });
    if (result.variant === 'ok') {
      refetch();
    }
  }, [invoke, schemaId, refetch]);

  // ── Remove field ───────────────────────────────────────────────────────────

  const handleRemoveClick = useCallback(async (fieldId: string, fieldLabel: string) => {
    // Check usage before removing
    if (pendingDeleteId !== fieldId) {
      // Check if in use
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
      // Not in use — delete immediately
    }
    // Confirmed delete
    setDeleteWarning(null);
    setPendingDeleteId(null);
    await invoke('FieldDefinition', 'remove', { field: fieldId, schema: schemaId });
    refetch();
  }, [invoke, schemaId, pendingDeleteId, refetch]);

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

    // Persist new order
    const ids = reordered.map((f) => f.id);
    await invoke('FieldDefinition', 'reorder', { schema: schemaId, fields: ids });
  }, [fields, invoke, schemaId]);

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(-1);
    dragIndexRef.current = -1;
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
        Loading fields...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--palette-error)', fontSize: 'var(--typography-body-sm-size)' }}>
        Failed to load fields: {error}
      </div>
    );
  }

  return (
    <div data-part="root" style={containerStyle}>
      {/* Header */}
      <div data-part="header" style={headerStyle}>
        <span style={{
          fontSize: 'var(--typography-label-md-size)',
          fontWeight: 'var(--typography-label-md-weight)' as React.CSSProperties['fontWeight'],
          color: 'var(--palette-on-surface)',
        }}>
          Fields
        </span>
        <span style={{
          fontSize: 'var(--typography-body-sm-size)',
          color: 'var(--palette-on-surface-variant)',
        }}>
          {fields.length} {fields.length === 1 ? 'field' : 'fields'}
        </span>
      </div>

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
          return (
            <div
              key={field.id}
              data-part="field-row"
              role="listitem"
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              style={{
                ...fieldRowBaseStyle,
                background: isDragOver
                  ? 'var(--palette-primary-container)'
                  : field.id === pendingDeleteId
                    ? 'var(--palette-error-container)'
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

              {/* Label */}
              <span data-part="field-label" style={fieldLabelStyle}>
                {field.label}
              </span>

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

              {/* Gear icon */}
              <button
                type="button"
                data-part="configure-button"
                style={gearBtnStyle}
                aria-label={`Configure ${field.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onFieldSelect?.(field.id);
                }}
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
