'use client';

/**
 * RecordDetailWidget — typed field input panel for the structured zone (TEV-3).
 *
 * Receives a ContentNode id, fetches its applied schemas, resolves each
 * schema's FieldDefinition list, and renders one labeled input row per field.
 * On every change a debounced ContentNode/update is dispatched that merges
 * the changed key into the node's content JSON while preserving all other keys.
 *
 * Field type -> editor mapping uses FIELD_TYPE_REGISTRY from FieldWidget so
 * coverage is always in sync with the registry.
 *
 * FSM: idle -> editing -> saving -> saved -> idle
 *
 * Section 16.9 (Surface widget specs), Section 16.11 (content-native platform)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { FieldWidget, FIELD_TYPE_REGISTRY } from './FieldWidget';
import type { SchemaField } from './FormMode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldDefinition {
  id: string;
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  validations?: string;
}

interface SchemaGroup {
  schemaId: string;
  schemaName: string;
  fields: FieldDefinition[];
}

type WidgetState = 'idle' | 'editing' | 'saving' | 'saved';

export interface RecordDetailWidgetProps {
  /** ContentNode id whose schema fields should be rendered. */
  node: string;
  /** Debounce delay before ContentNode/update is dispatched (ms). Default 600. */
  debounceMs?: number;
  /** When true, all inputs are disabled and no updates are sent. */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a FieldDefinition to a SchemaField shape expected by FieldWidget.
 * Only fields in FIELD_TYPE_REGISTRY are rendered; unknown types fall back
 * to text so coverage always matches the registry.
 */
function toSchemaField(fd: FieldDefinition): SchemaField {
  const registeredType = fd.type in FIELD_TYPE_REGISTRY ? fd.type : 'text';
  return {
    name: fd.name,
    label: fd.label ?? fd.name,
    type: registeredType,
    mutability: 'editable',
    options: fd.options,
    required: fd.required,
    placeholder: fd.placeholder,
    helpText: fd.helpText,
    validations: fd.validations,
  };
}

// ---------------------------------------------------------------------------
// RecordDetailWidget
// ---------------------------------------------------------------------------

export const RecordDetailWidget: React.FC<RecordDetailWidgetProps> = ({
  node,
  debounceMs = 600,
  readOnly = false,
}) => {
  const invoke = useKernelInvoke();

  // ── FSM state ─────────────────────────────────────────────────────────────
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [schemaGroups, setSchemaGroups] = useState<SchemaGroup[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load node + schemas + fields ──────────────────────────────────────────
  useEffect(() => {
    if (!node) return;
    let cancelled = false;

    const load = async () => {
      try {
        // 1. Fetch ContentNode to get its content JSON and applied schemas
        const nodeResult = await invoke('ContentNode', 'get', { id: node });
        if (cancelled) return;
        if (nodeResult.variant !== 'ok') {
          setLoadError('Could not load node');
          return;
        }

        const nodeData = nodeResult.output ?? nodeResult;
        // Extract content JSON (may be a JSON string or already parsed object)
        let content: Record<string, unknown> = {};
        const rawContent = nodeData.content ?? nodeData.output?.content ?? '{}';
        if (typeof rawContent === 'string') {
          try { content = JSON.parse(rawContent); } catch { content = {}; }
        } else if (rawContent && typeof rawContent === 'object') {
          content = rawContent as Record<string, unknown>;
        }

        // Extract applied schemas list
        let schemas: string[] = [];
        const rawSchemas = nodeData.schemas ?? nodeData.output?.schemas ?? [];
        if (Array.isArray(rawSchemas)) {
          schemas = rawSchemas as string[];
        } else if (typeof rawSchemas === 'string' && rawSchemas) {
          try { schemas = JSON.parse(rawSchemas); } catch { schemas = []; }
        }

        // 2. For each schema, fetch FieldDefinition list
        const groups: SchemaGroup[] = [];
        await Promise.all(
          schemas.map(async (schemaId) => {
            try {
              const fdResult = await invoke('FieldDefinition', 'list', { schema: schemaId });
              if (cancelled) return;
              if (fdResult.variant !== 'ok') return;
              const items: FieldDefinition[] = Array.isArray(fdResult.items)
                ? fdResult.items
                : Array.isArray(fdResult.output?.items)
                  ? fdResult.output.items
                  : [];
              if (items.length === 0) return;
              groups.push({ schemaId, schemaName: schemaId, fields: items });
            } catch {
              // Skip schemas that cannot be resolved
            }
          }),
        );

        if (cancelled) return;
        setSchemaGroups(groups);
        setValues(content);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Load failed');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [node, invoke]);

  // ── Auto-reset from saved -> idle ─────────────────────────────────────────
  useEffect(() => {
    if (widgetState === 'saved') {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setWidgetState('idle'), 1800);
    }
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, [widgetState]);

  // ── Persist changed value ─────────────────────────────────────────────────
  const persistValue = useCallback(
    async (key: string, value: unknown) => {
      setWidgetState('saving');
      try {
        // Merge only the changed key — ContentNode/update receives a delta object.
        // The handler merges this into the existing content JSON, preserving all
        // other keys not managed by this widget.
        const result = await invoke('ContentNode', 'update', {
          id: node,
          content: JSON.stringify({ [key]: value }),
        });
        if (result.variant === 'ok') {
          setWidgetState('saved');
        } else {
          setWidgetState('editing');
        }
      } catch {
        setWidgetState('editing');
      }
    },
    [invoke, node],
  );

  // ── Handle field change (debounced) ───────────────────────────────────────
  const handleChange = useCallback(
    (fieldName: string, value: unknown) => {
      if (readOnly) return;
      setWidgetState('editing');
      setValues((prev) => ({ ...prev, [fieldName]: value }));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistValue(fieldName, value);
      }, debounceMs);
    },
    [readOnly, debounceMs, persistValue],
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const isDisabled = readOnly || widgetState === 'saving';

  if (loadError) {
    return (
      <div
        data-part="root"
        data-state={widgetState}
        data-node={node}
        data-readonly={readOnly ? 'true' : 'false'}
        role="form"
        aria-label="Record fields"
        style={{ padding: 'var(--spacing-md)' }}
      >
        <span data-part="field-error" style={{ color: 'var(--palette-error)' }}>
          {loadError}
        </span>
      </div>
    );
  }

  const hasSchemas = schemaGroups.length > 0;

  return (
    <div
      data-part="root"
      data-state={widgetState}
      data-node={node}
      data-readonly={readOnly ? 'true' : 'false'}
      role="form"
      aria-label="Record fields"
      aria-busy={widgetState === 'saving' ? 'true' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
      }}
    >
      {/* Empty state */}
      {!hasSchemas && (
        <div
          data-part="empty-state"
          role="note"
          aria-label="No schemas applied"
          style={{
            color: 'var(--palette-secondary)',
            fontSize: 'var(--typography-body-sm-size)',
            textAlign: 'center',
            padding: 'var(--spacing-xl) var(--spacing-md)',
          }}
        >
          No schemas applied to this record.
        </div>
      )}

      {/* Schema groups */}
      {schemaGroups.map((group) => (
        <div
          key={group.schemaId}
          data-part="schema-group"
          data-schema={group.schemaId}
          role="group"
          aria-labelledby={`schema-label-${group.schemaId}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}
        >
          {/* Schema heading */}
          <div
            id={`schema-label-${group.schemaId}`}
            data-part="schema-label"
            role="heading"
            aria-level={3}
            style={{
              fontSize: 'var(--typography-label-sm-size)',
              fontWeight: 'var(--typography-weight-medium)',
              color: 'var(--palette-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              paddingBottom: 'var(--spacing-xs)',
              borderBottom: '1px solid var(--palette-outline)',
            }}
          >
            {group.schemaName}
          </div>

          {/* Field rows */}
          {group.fields.map((fd) => {
            const schemaField = toSchemaField(fd);
            const fieldValue = values[fd.name];

            return (
              <div
                key={fd.id}
                data-part="field-row"
                data-field={fd.name}
                data-type={fd.type}
                role="group"
                aria-label={`Field: ${fd.name}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  alignItems: 'start',
                  gap: 'var(--spacing-sm)',
                  minHeight: 'var(--spacing-xl)',
                }}
              >
                {/* Label */}
                <div
                  data-part="label"
                  style={{
                    fontSize: 'var(--typography-body-sm-size)',
                    color: 'var(--palette-secondary)',
                    paddingTop: 'var(--spacing-xs)',
                    fontWeight: 'var(--typography-weight-medium)',
                  }}
                >
                  {schemaField.label}
                  {fd.required && (
                    <span
                      aria-hidden="true"
                      style={{ color: 'var(--palette-error)', marginLeft: '2px' }}
                    >
                      *
                    </span>
                  )}
                </div>

                {/* Typed input — delegates to FieldWidget which covers FIELD_TYPE_REGISTRY */}
                <div
                  data-part="field-input"
                  data-field={fd.name}
                  data-type={fd.type}
                  style={{ opacity: isDisabled ? 0.6 : 1, pointerEvents: isDisabled ? 'none' : undefined }}
                >
                  <FieldWidget
                    field={schemaField}
                    value={fieldValue}
                    onChange={(v) => handleChange(fd.name, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Save status indicator */}
      <div
        data-part="save-status"
        data-state={widgetState}
        role="status"
        aria-live="polite"
        hidden={widgetState === 'idle' || widgetState === 'editing'}
        style={{
          fontSize: 'var(--typography-body-xs-size)',
          color: widgetState === 'saved' ? 'var(--palette-success)' : 'var(--palette-secondary)',
          textAlign: 'right',
          minHeight: '1em',
        }}
      >
        {widgetState === 'saving' && 'Saving...'}
        {widgetState === 'saved' && 'Saved'}
      </div>
    </div>
  );
};

export default RecordDetailWidget;
