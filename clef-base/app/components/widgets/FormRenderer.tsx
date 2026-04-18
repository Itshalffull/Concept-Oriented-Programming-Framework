'use client';

/**
 * FormRenderer — runtime form renderer for Clef Base.
 *
 * Reads FormSpec + FieldDefinitions from the kernel, renders typed fields
 * via FieldWidget, supports field groups (section/tab/accordion/fieldset/columns),
 * multi-step wizard navigation, conditional visibility, and blur/submit validation.
 *
 * See architecture doc Section 10.1 for content-native schema patterns.
 */

import React, { useState, useCallback, useEffect, useId } from 'react';
import { FieldWidget } from './FieldWidget';
import type { SchemaField } from './FormMode';
import { validateField, parseValidationRules } from '../../../lib/form-validation';
import { getVisibleFields, parseConditions } from '../../../lib/form-conditions';
import type { FieldCondition } from '../../../lib/form-conditions';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { isVariableProgramExpression, resolveExpression } from '../../../lib/variable-program';

// ─── FormSpec types ────────────────────────────────────────────────────────────

/** A single step in a multi-step form wizard. */
export interface FormStep {
  id: string;
  label: string;
  /** Group IDs that belong to this step. */
  groupIds: string[];
}

/** A group of fields rendered with a specific layout strategy. */
export interface FormGroup {
  id: string;
  label?: string;
  type: 'section' | 'tab' | 'accordion' | 'fieldset' | 'columns';
  /** Field IDs included in this group (ordered). */
  fieldIds: string[];
  /** For columns layout: how many columns. Default 2. */
  columnCount?: number;
  /** For accordion: whether collapsed by default. */
  collapsed?: boolean;
}

/** The resolved FormSpec from FormSpec/resolve. */
export interface FormSpec {
  name: string;
  schemaId: string;
  mode: 'create' | 'edit';
  steps?: FormStep[];
  groups?: FormGroup[];
  /** Condition JSON for fields not assigned to any group (flat fields). */
  conditions?: string;
}

/** A FieldDefinition from FieldDefinition/list. */
export interface FieldDefinition {
  id: string;
  schemaId: string;
  label?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  validations?: string;   // JSON ValidationRule[]
  conditions?: string;    // JSON FieldCondition (single entry)
  options?: string[];
  mutability?: 'editable' | 'readonly' | 'system';
  sortOrder?: number;
  /**
   * Default value for this field when rendering a create-mode form.
   * May be a literal string or a VariableProgram expression (starts with `$` or `'`).
   * VariableProgram expressions are resolved against the current runtime context
   * (session, URL params, page context) when the form mounts.
   */
  defaultValue?: string;
}

// ─── FormRendererProps ────────────────────────────────────────────────────────

export interface FormRendererProps {
  schemaId: string;
  mode: 'create' | 'edit';
  /** Specific FormSpec name, or resolve default for the schema+mode. */
  formName?: string;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  onCancel?: () => void;
  /** When true: hide step bar, minimize padding (e.g., inside a modal). */
  compact?: boolean;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Convert a FieldDefinition to a SchemaField for FieldWidget. */
function toSchemaField(def: FieldDefinition): SchemaField {
  return {
    name: def.id,
    label: def.label,
    type: def.type,
    required: def.required,
    placeholder: def.placeholder,
    helpText: def.helpText,
    validations: def.validations,
    options: def.options,
    mutability: def.mutability,
  };
}

/** Build a FieldCondition[] from per-field conditions JSON. */
function buildConditions(defs: FieldDefinition[]): FieldCondition[] {
  const result: FieldCondition[] = [];
  for (const def of defs) {
    if (!def.conditions) continue;
    const parsed = parseConditions(def.conditions);
    // Each field's conditions JSON may be an array or a single object.
    // parseConditions already returns an array; push all entries.
    result.push(...parsed);
  }
  return result;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--palette-outline)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--spacing-lg)',
  marginBottom: 'var(--spacing-lg)',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 'var(--typography-label-lg-size)',
  fontWeight: 'var(--typography-label-lg-weight)',
  marginBottom: 'var(--spacing-md)',
  color: 'var(--palette-on-surface)',
};

const fieldWrapperStyle: React.CSSProperties = {
  marginBottom: 'var(--spacing-md)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--spacing-xs)',
  fontSize: 'var(--typography-label-md-size)',
  fontWeight: 'var(--typography-label-md-weight)',
  color: 'var(--palette-on-surface)',
};

const errorTextStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '4px',
  fontSize: 'var(--typography-label-sm-size)',
  color: 'var(--palette-error)',
};

const errorSummaryStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  background: 'var(--palette-error-container)',
  color: 'var(--palette-on-error-container)',
  borderRadius: 'var(--radius-sm)',
  marginBottom: 'var(--spacing-md)',
  fontSize: 'var(--typography-body-sm-size)',
};

// ─── RenderedField ────────────────────────────────────────────────────────────

interface RenderedFieldProps {
  def: FieldDefinition;
  value: unknown;
  onChange: (id: string, value: unknown) => void;
  errors: string[];
  onBlur: (id: string) => void;
}

const RenderedField: React.FC<RenderedFieldProps> = ({ def, value, onChange, errors, onBlur }) => {
  const errorId = useId();
  const hasError = errors.length > 0;
  const field = toSchemaField(def);

  return (
    <div style={fieldWrapperStyle} data-part="form-field" data-field-id={def.id}>
      <label htmlFor={`field-${def.id}`} style={labelStyle}>
        {def.label ?? def.id}
        {def.required && (
          <span style={{ color: 'var(--palette-error)', marginLeft: '2px' }} aria-hidden="true">*</span>
        )}
      </label>
      <div
        onBlur={() => onBlur(def.id)}
        id={`field-${def.id}`}
        aria-describedby={hasError ? errorId : undefined}
      >
        <FieldWidget
          field={field}
          value={value}
          onChange={(v) => onChange(def.id, v)}
        />
      </div>
      {hasError && (
        <span id={errorId} style={errorTextStyle} role="alert" data-part="field-error">
          {errors[0]}
        </span>
      )}
    </div>
  );
};

// ─── GroupRenderer ────────────────────────────────────────────────────────────

interface GroupRendererProps {
  group: FormGroup;
  visibleFieldIds: Set<string>;
  fieldDefs: Map<string, FieldDefinition>;
  values: Record<string, unknown>;
  errors: Record<string, string[]>;
  touchedFields: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onBlur: (id: string) => void;
}

const GroupRenderer: React.FC<GroupRendererProps> = ({
  group, visibleFieldIds, fieldDefs, values, errors, touchedFields, onChange, onBlur,
}) => {
  const [collapsed, setCollapsed] = useState(group.collapsed ?? false);
  const [activeTab, setActiveTab] = useState(0);

  // Only render fields that are both in this group and visible
  const visibleIds = group.fieldIds.filter((id) => visibleFieldIds.has(id));
  if (visibleIds.length === 0) return null;

  const renderField = (fieldId: string) => {
    const def = fieldDefs.get(fieldId);
    if (!def) return null;
    const fieldErrors = touchedFields.has(fieldId) ? (errors[fieldId] ?? []) : [];
    return (
      <RenderedField
        key={fieldId}
        def={def}
        value={values[fieldId]}
        onChange={onChange}
        errors={fieldErrors}
        onBlur={onBlur}
      />
    );
  };

  switch (group.type) {
    case 'section': {
      return (
        <div style={sectionStyle} data-part="group" data-group-type="section" data-group-id={group.id}>
          {group.label && <div style={sectionHeaderStyle}>{group.label}</div>}
          {visibleIds.map(renderField)}
        </div>
      );
    }

    case 'fieldset': {
      return (
        <fieldset
          style={{ ...sectionStyle, borderColor: 'var(--palette-outline-variant)' }}
          data-part="group"
          data-group-type="fieldset"
          data-group-id={group.id}
        >
          {group.label && (
            <legend style={{ padding: '0 var(--spacing-xs)', ...sectionHeaderStyle }}>
              {group.label}
            </legend>
          )}
          {visibleIds.map(renderField)}
        </fieldset>
      );
    }

    case 'accordion': {
      return (
        <div
          style={{ border: '1px solid var(--palette-outline)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-md)', overflow: 'hidden' }}
          data-part="group"
          data-group-type="accordion"
          data-group-id={group.id}
          data-state={collapsed ? 'collapsed' : 'expanded'}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              background: 'var(--palette-surface-variant)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--typography-label-md-size)',
              fontWeight: 'var(--typography-label-md-weight)',
              color: 'var(--palette-on-surface)',
              textAlign: 'left',
            }}
            aria-expanded={!collapsed}
            data-part="accordion-trigger"
          >
            <span>{group.label ?? group.id}</span>
            <span style={{ fontSize: '12px', opacity: 0.6, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.15s' }}>
              ▼
            </span>
          </button>
          {!collapsed && (
            <div style={{ padding: 'var(--spacing-lg)' }} data-part="accordion-content">
              {visibleIds.map(renderField)}
            </div>
          )}
        </div>
      );
    }

    case 'tab': {
      // Tab groups render a tab bar scoped to this group's fields.
      // Each tab shows one field (or the group can be interpreted as field-per-tab).
      // For simplicity: all fields show in a single tab pane, tab bar is per-group.
      // In practice, multiple tab groups are placed side-by-side; this renders the first active.
      const tabIds = visibleIds;
      const safeActiveTab = Math.min(activeTab, tabIds.length - 1);
      return (
        <div
          style={{ marginBottom: 'var(--spacing-lg)' }}
          data-part="group"
          data-group-type="tab"
          data-group-id={group.id}
        >
          {group.label && <div style={sectionHeaderStyle}>{group.label}</div>}
          <div
            style={{ display: 'flex', borderBottom: '1px solid var(--palette-outline)', marginBottom: 'var(--spacing-md)', gap: 'var(--spacing-xs)' }}
            role="tablist"
            data-part="tab-list"
          >
            {tabIds.map((id, idx) => {
              const def = fieldDefs.get(id);
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={idx === safeActiveTab}
                  onClick={() => setActiveTab(idx)}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    border: 'none',
                    borderBottom: idx === safeActiveTab
                      ? '2px solid var(--palette-primary)'
                      : '2px solid transparent',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--typography-label-md-size)',
                    color: idx === safeActiveTab ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)',
                    fontWeight: idx === safeActiveTab ? 'var(--typography-label-md-weight)' : undefined,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  data-part="tab"
                  data-state={idx === safeActiveTab ? 'active' : 'inactive'}
                >
                  {def?.label ?? id}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" data-part="tab-panel">
            {renderField(tabIds[safeActiveTab])}
          </div>
        </div>
      );
    }

    case 'columns': {
      const cols = group.columnCount ?? 2;
      return (
        <div
          style={{ marginBottom: 'var(--spacing-lg)' }}
          data-part="group"
          data-group-type="columns"
          data-group-id={group.id}
        >
          {group.label && <div style={sectionHeaderStyle}>{group.label}</div>}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 'var(--spacing-md)',
            }}
            data-part="columns-grid"
          >
            {visibleIds.map(renderField)}
          </div>
        </div>
      );
    }

    default: {
      return (
        <div style={sectionStyle} data-part="group" data-group-type="unknown" data-group-id={group.id}>
          {group.label && <div style={sectionHeaderStyle}>{group.label}</div>}
          {visibleIds.map(renderField)}
        </div>
      );
    }
  }
};

// ─── StepBar ──────────────────────────────────────────────────────────────────

interface StepBarProps {
  steps: FormStep[];
  currentStep: number;
  compact?: boolean;
}

const StepBar: React.FC<StepBarProps> = ({ steps, currentStep, compact }) => {
  if (compact || steps.length <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 'var(--spacing-xl)',
        gap: 0,
      }}
      data-part="step-bar"
      role="list"
      aria-label="Form steps"
    >
      {steps.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isActive = idx === currentStep;
        return (
          <React.Fragment key={step.id}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                flex: 1,
              }}
              role="listitem"
              data-part="step"
              data-state={isActive ? 'active' : isComplete ? 'complete' : 'pending'}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--typography-label-sm-size)',
                  fontWeight: 'bold',
                  background: isActive
                    ? 'var(--palette-primary)'
                    : isComplete
                    ? 'var(--palette-primary-container)'
                    : 'var(--palette-surface-variant)',
                  color: isActive
                    ? 'var(--palette-on-primary)'
                    : isComplete
                    ? 'var(--palette-on-primary-container)'
                    : 'var(--palette-on-surface-variant)',
                  border: isActive
                    ? '2px solid var(--palette-primary)'
                    : '2px solid var(--palette-outline)',
                  transition: 'background 0.15s, color 0.15s',
                }}
                aria-current={isActive ? 'step' : undefined}
                data-part="step-dot"
              >
                {isComplete ? '✓' : idx + 1}
              </div>
              <span
                style={{
                  fontSize: 'var(--typography-label-sm-size)',
                  color: isActive
                    ? 'var(--palette-primary)'
                    : 'var(--palette-on-surface-variant)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
                data-part="step-label"
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                style={{
                  height: 2,
                  flex: 1,
                  marginBottom: '22px',
                  background: idx < currentStep
                    ? 'var(--palette-primary)'
                    : 'var(--palette-outline)',
                  transition: 'background 0.15s',
                }}
                data-part="step-connector"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── FlatFallback ─────────────────────────────────────────────────────────────

/** Renders all visible fields flat (no groups, no steps). Used when FormSpec is not found. */
const FlatFallback: React.FC<{
  fieldDefs: FieldDefinition[];
  visibleFieldIds: Set<string>;
  values: Record<string, unknown>;
  errors: Record<string, string[]>;
  touchedFields: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onBlur: (id: string) => void;
}> = ({ fieldDefs, visibleFieldIds, values, errors, touchedFields, onChange, onBlur }) => (
  <>
    {fieldDefs
      .filter((def) => visibleFieldIds.has(def.id))
      .map((def) => {
        const fieldErrors = touchedFields.has(def.id) ? (errors[def.id] ?? []) : [];
        return (
          <RenderedField
            key={def.id}
            def={def}
            value={values[def.id]}
            onChange={onChange}
            errors={fieldErrors}
            onBlur={onBlur}
          />
        );
      })}
  </>
);

// ─── FormRenderer ─────────────────────────────────────────────────────────────

export const FormRenderer: React.FC<FormRendererProps> = ({
  schemaId,
  mode,
  formName,
  initialValues = {},
  onSubmit,
  onCancel,
  compact = false,
}) => {
  const invoke = useKernelInvoke();

  // ── Loading state ──
  const [formSpec, setFormSpec] = useState<FormSpec | null>(null);
  const [fieldDefs, setFieldDefs] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Form state ──
  // Initialised from props; VariableProgram defaults are merged in after load (see load effect).
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Multi-step ──
  const [currentStep, setCurrentStep] = useState(0);

  // ── Load FormSpec and FieldDefinitions ──
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        // Resolve FormSpec
        const specResult = await invoke('FormSpec', 'resolve', {
          schemaId,
          mode,
          ...(formName ? { name: formName } : {}),
        });
        const spec: FormSpec | null =
          specResult.variant === 'ok' ? (specResult.spec as FormSpec) : null;

        // Load FieldDefinitions for the schema
        const defsResult = await invoke('FieldDefinition', 'list', { schemaId });
        const defs: FieldDefinition[] =
          defsResult.variant === 'ok'
            ? (typeof defsResult.items === 'string'
                ? (JSON.parse(defsResult.items) as FieldDefinition[])
                : (defsResult.items as FieldDefinition[]))
            : [];

        // Sort by sortOrder if available
        defs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        // Resolve VariableProgram default values for fields not covered by initialValues.
        // Each field with a defaultValue that is a VariableProgram expression
        // (starts with `$` or `'`) is resolved against the current runtime context.
        // Literal defaultValues are used as-is. Fields already present in
        // initialValues are never overwritten.
        const resolvedDefaults: Record<string, unknown> = {};
        await Promise.all(
          defs
            .filter((def) => def.defaultValue !== undefined && !(def.id in initialValues))
            .map(async (def) => {
              const raw = def.defaultValue!;
              if (isVariableProgramExpression(raw)) {
                try {
                  resolvedDefaults[def.id] = await resolveExpression(raw);
                } catch {
                  // Resolution failed — use the raw expression string as fallback
                  // so that literal defaults continue to work even when the
                  // VariableProgram kernel concept is unavailable.
                  resolvedDefaults[def.id] = raw;
                }
              } else {
                // Literal default value — use directly.
                resolvedDefaults[def.id] = raw;
              }
            }),
        );

        if (!cancelled) {
          setFormSpec(spec);
          setFieldDefs(defs);
          // Seed the values state with resolved defaults. initialValues always wins
          // over resolved defaults (already excluded above).
          if (Object.keys(resolvedDefaults).length > 0) {
            setValues((prev) => ({ ...resolvedDefaults, ...prev }));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load form');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [schemaId, mode, formName, invoke]);

  // ── Derived: conditions + visible fields ──
  const allFieldIds = fieldDefs.map((d) => d.id);
  const conditions = buildConditions(fieldDefs);
  const visibleFieldIds = getVisibleFields(allFieldIds, conditions, values);

  // ── Derived: field defs map ──
  const fieldDefMap = new Map<string, FieldDefinition>(fieldDefs.map((d) => [d.id, d]));

  // ── Handlers ──
  const handleChange = useCallback((id: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleBlur = useCallback((id: string) => {
    setTouchedFields((prev) => new Set([...prev, id]));
    // Run validation for this field immediately on blur
    const def = fieldDefMap.get(id);
    if (!def) return;
    const rules = def.validations ? parseValidationRules(def.validations) : [];
    const errors = validateField(values[id], rules);
    setFieldErrors((prev) => ({ ...prev, [id]: errors }));
  }, [fieldDefMap, values]);

  /**
   * Validate a set of field IDs and return whether all pass.
   * Marks all provided fields as touched (so errors display).
   */
  const validateFields = useCallback((fieldIds: string[]): boolean => {
    const visibleIds = fieldIds.filter((id) => visibleFieldIds.has(id));
    const newErrors: Record<string, string[]> = { ...fieldErrors };
    const newTouched = new Set(touchedFields);
    let allValid = true;

    for (const id of visibleIds) {
      const def = fieldDefMap.get(id);
      if (!def) continue;
      const rules = def.validations ? parseValidationRules(def.validations) : [];
      const errors = validateField(values[id], rules);
      newErrors[id] = errors;
      newTouched.add(id);
      if (errors.length > 0) allValid = false;
    }

    setFieldErrors(newErrors);
    setTouchedFields(newTouched);
    return allValid;
  }, [visibleFieldIds, fieldErrors, touchedFields, fieldDefMap, values]);

  // ── Step navigation ──
  const steps = formSpec?.steps ?? [];
  const hasSteps = steps.length > 0;

  /** Field IDs in the current step (or all visible fields for flat forms). */
  const currentStepFieldIds: string[] = hasSteps
    ? (steps[currentStep]?.groupIds ?? []).flatMap((gid) => {
        const group = formSpec?.groups?.find((g) => g.id === gid);
        return group ? group.fieldIds : [];
      })
    : allFieldIds;

  const handleNext = useCallback(() => {
    const valid = validateFields(currentStepFieldIds);
    if (valid) setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }, [validateFields, currentStepFieldIds, steps.length]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate all visible fields
    const valid = validateFields(allFieldIds);
    if (!valid) {
      setSubmitError('Please fix the errors below before submitting.');
      return;
    }

    // Build submission: only visible fields
    const submission: Record<string, unknown> = {};
    for (const id of allFieldIds) {
      if (visibleFieldIds.has(id)) {
        submission[id] = values[id];
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(submission);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [validateFields, allFieldIds, visibleFieldIds, values, onSubmit]);

  // ── Render: loading / error ──
  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--palette-on-surface-variant)' }} data-part="form-renderer" data-state="loading">
        Loading form...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-error)' }} data-part="form-renderer" data-state="error">
        Error loading form: {loadError}
      </div>
    );
  }

  // ── Render: error summary (submit attempt with errors) ──
  const hasVisibleErrors = Object.entries(fieldErrors).some(
    ([id, errs]) => errs.length > 0 && visibleFieldIds.has(id),
  );

  // ── Render: groups for current step ──
  const renderGroups = () => {
    if (!formSpec) {
      // Flat fallback — no FormSpec found
      return (
        <FlatFallback
          fieldDefs={fieldDefs}
          visibleFieldIds={visibleFieldIds}
          values={values}
          errors={fieldErrors}
          touchedFields={touchedFields}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      );
    }

    const groups = formSpec.groups ?? [];

    // If there are steps, only show groups for the current step
    const activeGroupIds: string[] = hasSteps
      ? (steps[currentStep]?.groupIds ?? [])
      : groups.map((g) => g.id);

    if (activeGroupIds.length === 0) {
      // Step has no group assignments — render fields in the step flatly
      const stepFieldIds = currentStepFieldIds.filter((id) => visibleFieldIds.has(id));
      return (
        <>
          {stepFieldIds.map((id) => {
            const def = fieldDefMap.get(id);
            if (!def) return null;
            const errors = touchedFields.has(id) ? (fieldErrors[id] ?? []) : [];
            return (
              <RenderedField
                key={id}
                def={def}
                value={values[id]}
                onChange={handleChange}
                errors={errors}
                onBlur={handleBlur}
              />
            );
          })}
        </>
      );
    }

    // Render tab groups together (they form a tab bar unit)
    const tabGroupSet = activeGroupIds
      .map((id) => groups.find((g) => g.id === id))
      .filter((g): g is FormGroup => g?.type === 'tab');

    const nonTabGroupIds = activeGroupIds.filter((id) => {
      const g = groups.find((grp) => grp.id === id);
      return g?.type !== 'tab';
    });

    return (
      <>
        {tabGroupSet.length > 0 && (
          <TabGroupsRenderer
            tabGroups={tabGroupSet}
            visibleFieldIds={visibleFieldIds}
            fieldDefs={fieldDefMap}
            values={values}
            errors={fieldErrors}
            touchedFields={touchedFields}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        )}
        {nonTabGroupIds.map((gid) => {
          const group = groups.find((g) => g.id === gid);
          if (!group) return null;
          return (
            <GroupRenderer
              key={gid}
              group={group}
              visibleFieldIds={visibleFieldIds}
              fieldDefs={fieldDefMap}
              values={values}
              errors={fieldErrors}
              touchedFields={touchedFields}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          );
        })}
      </>
    );
  };

  const isLastStep = !hasSteps || currentStep === steps.length - 1;

  return (
    <div data-part="form-renderer" data-schema-id={schemaId} data-mode={mode}>
      {!compact && hasSteps && (
        <StepBar steps={steps} currentStep={currentStep} compact={compact} />
      )}

      <form onSubmit={handleSubmit} noValidate data-part="form">
        {/* Error summary */}
        {submitError && (
          <div style={errorSummaryStyle} role="alert" data-part="error-summary">
            {submitError}
            {hasVisibleErrors && (
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 'var(--spacing-md)' }}>
                {Object.entries(fieldErrors)
                  .filter(([id, errs]) => errs.length > 0 && visibleFieldIds.has(id))
                  .map(([id, errs]) => (
                    <li key={id}>
                      <strong>{fieldDefMap.get(id)?.label ?? id}</strong>: {errs[0]}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {/* Form body */}
        <div style={compact ? {} : { padding: 'var(--spacing-sm) 0' }} data-part="form-body">
          {renderGroups()}
        </div>

        {/* Action bar */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-sm)',
            justifyContent: 'flex-end',
            marginTop: 'var(--spacing-xl)',
            paddingTop: 'var(--spacing-md)',
            borderTop: '1px solid var(--palette-outline-variant)',
          }}
          data-part="action-bar"
        >
          {onCancel && (
            <button
              type="button"
              data-part="button"
              data-variant="outlined"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}

          {hasSteps && currentStep > 0 && (
            <button
              type="button"
              data-part="button"
              data-variant="outlined"
              onClick={handleBack}
              disabled={submitting}
            >
              Back
            </button>
          )}

          {hasSteps && !isLastStep ? (
            <button
              type="button"
              data-part="button"
              data-variant="filled"
              onClick={handleNext}
              disabled={submitting}
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              data-part="button"
              data-variant="filled"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

// ─── TabGroupsRenderer ────────────────────────────────────────────────────────

/**
 * When multiple groups in a step all have type="tab", they form a unified
 * tab bar where each group is one tab (not each field).
 */
interface TabGroupsRendererProps {
  tabGroups: FormGroup[];
  visibleFieldIds: Set<string>;
  fieldDefs: Map<string, FieldDefinition>;
  values: Record<string, unknown>;
  errors: Record<string, string[]>;
  touchedFields: Set<string>;
  onChange: (id: string, value: unknown) => void;
  onBlur: (id: string) => void;
}

const TabGroupsRenderer: React.FC<TabGroupsRendererProps> = ({
  tabGroups, visibleFieldIds, fieldDefs, values, errors, touchedFields, onChange, onBlur,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const visibleGroupIds = tabGroups.filter((g) =>
    g.fieldIds.some((id) => visibleFieldIds.has(id)),
  );
  const safeIdx = Math.min(activeIdx, visibleGroupIds.length - 1);
  const activeGroup = visibleGroupIds[safeIdx];

  if (visibleGroupIds.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--spacing-lg)' }} data-part="tab-groups">
      <div
        style={{ display: 'flex', borderBottom: '1px solid var(--palette-outline)', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}
        role="tablist"
        data-part="tab-list"
      >
        {visibleGroupIds.map((group, idx) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={idx === safeIdx}
            onClick={() => setActiveIdx(idx)}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: 'none',
              borderBottom: idx === safeIdx
                ? '2px solid var(--palette-primary)'
                : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 'var(--typography-label-md-size)',
              color: idx === safeIdx ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)',
              fontWeight: idx === safeIdx ? 'var(--typography-label-md-weight)' : undefined,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            data-part="tab"
            data-state={idx === safeIdx ? 'active' : 'inactive'}
          >
            {group.label ?? group.id}
          </button>
        ))}
      </div>
      <div role="tabpanel" data-part="tab-panel">
        {activeGroup && (
          <GroupRenderer
            group={{ ...activeGroup, type: 'section' }}
            visibleFieldIds={visibleFieldIds}
            fieldDefs={fieldDefs}
            values={values}
            errors={errors}
            touchedFields={touchedFields}
            onChange={onChange}
            onBlur={onBlur}
          />
        )}
      </div>
    </div>
  );
};

export default FormRenderer;
