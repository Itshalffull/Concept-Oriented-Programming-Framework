'use client';

/**
 * BindingEditor — Reusable editor for a single action/UI-event binding.
 *
 * Supports three binding modes via progressive disclosure:
 *   Action       — typed {concept, action, inputs} via ConceptActionPicker
 *   UI Event     — wraps a UIEventBinding (9 canonical surface effects)
 *   Composite    — ordered list of Action/UIEvent steps invoked in sequence
 *
 * Used by SlotSourceEditor (ComponentMapping action bindings),
 * AutomationRuleBuilder (output actions), WorkflowBuilder (transition
 * effects), and ViewEditor (rowClick / rowActions).
 *
 * Legacy migration: a string of shape "Concept/action" parses to
 *   {mode: 'action', action: {concept: "Concept", action: "action", inputs: {}}}
 * so older records continue to load.
 */

import React, { useCallback, useState } from 'react';
import { ConceptActionPicker } from './ConceptActionPicker';

// ---------------------------------------------------------------------------
// Binding kind types
// ---------------------------------------------------------------------------

/** The three binding modes available in the advanced editor */
export type BindingMode = 'action' | 'ui-event' | 'composite';

/**
 * The 9 canonical UI effect kinds declared in UIEventBinding.
 * Kept in sync with specs/app/ui-event-binding.concept.
 */
const UI_EVENT_KINDS = [
  'navigate',
  'open-modal',
  'close-modal',
  'dismiss',
  'focus',
  'scroll-to',
  'set-local-state',
  'emit-event',
  'toast',
] as const;
export type UIEventKind = (typeof UI_EVENT_KINDS)[number];

const UI_EVENT_KIND_LABELS: Record<UIEventKind, string> = {
  'navigate':        'Navigate',
  'open-modal':      'Open Modal',
  'close-modal':     'Close Modal',
  'dismiss':         'Dismiss Overlay',
  'focus':           'Focus Element',
  'scroll-to':       'Scroll To',
  'set-local-state': 'Set Local State',
  'emit-event':      'Emit FSM Event',
  'toast':           'Toast Notification',
};

const UI_EVENT_KIND_HINTS: Record<UIEventKind, string> = {
  'navigate':        'Destination id or href template',
  'open-modal':      'Modal id or widget ref',
  'close-modal':     'Modal id, or "top" for topmost',
  'dismiss':         'Leave blank — dismisses the topmost overlay',
  'focus':           'Element selector or widget-part label',
  'scroll-to':       'Element selector or widget-part label',
  'set-local-state': 'State path (e.g. sidebar.open)',
  'emit-event':      'Machine id or widget-part label',
  'toast':           'Toast variant: success | error | info | warning',
};

export interface UIEventStep {
  kind: UIEventKind;
  target: string;
  params: string;
}

/** Typed action reference: concept, action, and input field map. */
export interface ActionStep {
  concept: string;
  action: string;
  inputs: Record<string, string>;
}

export interface CompositeStep {
  mode: 'action' | 'ui-event';
  /** used when mode='action' */
  action: ActionStep;
  /** used when mode='ui-event' */
  uiEvent: UIEventStep;
}

/** Serialised form stored in binding fields (ComponentMapping, AutomationRule, Workflow, View) */
export interface BindingValue {
  mode: BindingMode;
  /** Typed action binding — only for mode='action' */
  action?: ActionStep;
  /** UIEvent config — only for mode='ui-event' */
  uiEvent?: UIEventStep;
  /** Ordered steps — only for mode='composite' */
  steps?: CompositeStep[];
}

// ---------------------------------------------------------------------------
// Public helpers — migration + empty state
// ---------------------------------------------------------------------------

export function emptyAction(): ActionStep {
  return { concept: '', action: '', inputs: {} };
}

export function emptyUIEvent(): UIEventStep {
  return { kind: 'navigate', target: '', params: '{}' };
}

export function emptyBindingValue(): BindingValue {
  return { mode: 'action', action: emptyAction() };
}

/**
 * Parse a legacy "Concept/action" string into an ActionStep. Non-matching
 * strings land as {concept: "", action: raw, inputs: {}} so the user sees
 * their content and can re-pick via ConceptActionPicker.
 */
export function parseLegacyActionRef(raw: string): ActionStep {
  if (!raw) return emptyAction();
  const slash = raw.indexOf('/');
  if (slash === -1) return { concept: '', action: raw, inputs: {} };
  return {
    concept: raw.slice(0, slash),
    action: raw.slice(slash + 1),
    inputs: {},
  };
}

/**
 * Upgrade a raw BindingValue (possibly carrying legacy `actionRef: string`
 * fields) to the current typed shape. Safe to call on fresh values too —
 * missing `action` defaults to an empty ActionStep.
 */
export function migrateBindingValue(raw: unknown): BindingValue {
  if (!raw || typeof raw !== 'object') return emptyBindingValue();
  const obj = raw as Record<string, unknown>;
  const mode = (obj.mode as BindingMode | undefined) ?? 'action';

  if (mode === 'action') {
    const action = obj.action as Partial<ActionStep> | undefined;
    if (action && typeof action === 'object' && typeof action.concept === 'string') {
      return {
        mode: 'action',
        action: {
          concept: action.concept,
          action: action.action ?? '',
          inputs: (action.inputs as Record<string, string>) ?? {},
        },
      };
    }
    // Legacy: actionRef string
    const legacy = typeof obj.actionRef === 'string' ? obj.actionRef : '';
    return { mode: 'action', action: parseLegacyActionRef(legacy) };
  }

  if (mode === 'ui-event') {
    const ui = obj.uiEvent as Partial<UIEventStep> | undefined;
    return {
      mode: 'ui-event',
      uiEvent: {
        kind: (ui?.kind as UIEventKind) ?? 'navigate',
        target: ui?.target ?? '',
        params: ui?.params ?? '{}',
      },
    };
  }

  if (mode === 'composite') {
    const steps = Array.isArray(obj.steps) ? obj.steps : [];
    return {
      mode: 'composite',
      steps: steps.map((s: unknown) => migrateCompositeStep(s)),
    };
  }

  return emptyBindingValue();
}

function migrateCompositeStep(raw: unknown): CompositeStep {
  if (!raw || typeof raw !== 'object') {
    return { mode: 'action', action: emptyAction(), uiEvent: emptyUIEvent() };
  }
  const obj = raw as Record<string, unknown>;
  const stepMode = (obj.mode as 'action' | 'ui-event') ?? 'action';

  // Migrate typed action (new) or legacy actionRef string
  let action: ActionStep;
  if (obj.action && typeof obj.action === 'object') {
    const a = obj.action as Partial<ActionStep>;
    action = {
      concept: a.concept ?? '',
      action: a.action ?? '',
      inputs: (a.inputs as Record<string, string>) ?? {},
    };
  } else if (typeof obj.actionRef === 'string') {
    action = parseLegacyActionRef(obj.actionRef);
  } else {
    action = emptyAction();
  }

  const ui = obj.uiEvent as Partial<UIEventStep> | undefined;
  const uiEvent: UIEventStep = {
    kind: (ui?.kind as UIEventKind) ?? 'navigate',
    target: ui?.target ?? '',
    params: ui?.params ?? '{}',
  };

  return { mode: stepMode, action, uiEvent };
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  border: '1px solid var(--palette-outline-variant)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
  minWidth: 0,
};

const selectStyle: React.CSSProperties = {
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  border: '1px solid var(--palette-outline-variant)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--palette-surface)',
  color: 'var(--palette-on-surface)',
  fontSize: 'var(--typography-body-sm-size)',
};

const removeButtonStyle: React.CSSProperties = {
  padding: 'var(--spacing-xs)',
  border: 'none',
  background: 'transparent',
  color: 'var(--palette-error)',
  cursor: 'pointer',
  fontSize: 'var(--typography-body-sm-size)',
  lineHeight: 1,
};

const advancedToggleStyle: React.CSSProperties = {
  fontSize: 'var(--typography-body-xs-size)',
  color: 'var(--palette-on-surface-variant)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
};

// ---------------------------------------------------------------------------
// Action inputs editor — key/value rows for an ActionStep
// ---------------------------------------------------------------------------

const ActionInputsEditor: React.FC<{
  inputs: Record<string, string>;
  onChange: (inputs: Record<string, string>) => void;
}> = ({ inputs, onChange }) => {
  const entries = Object.entries(inputs);

  const updateKey = useCallback((oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  }, [inputs, onChange]);

  const updateValue = useCallback((key: string, value: string) => {
    onChange({ ...inputs, [key]: value });
  }, [inputs, onChange]);

  const removeKey = useCallback((key: string) => {
    const next = { ...inputs };
    delete next[key];
    onChange(next);
  }, [inputs, onChange]);

  const addKey = useCallback(() => {
    const newKey = `key${Object.keys(inputs).length + 1}`;
    onChange({ ...inputs, [newKey]: '' });
  }, [inputs, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--spacing-xs)' }}>
      <span style={{
        fontSize: 'var(--typography-label-sm-size)',
        color: 'var(--palette-on-surface-variant)',
      }}>
        Inputs
      </span>
      {entries.length === 0 && (
        <span style={{
          fontSize: 'var(--typography-body-xs-size)',
          color: 'var(--palette-on-surface-variant)',
          fontStyle: 'italic',
        }}>
          No inputs — add one to bind an action parameter.
        </span>
      )}
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 4, alignItems: 'center' }}
        >
          <input
            style={{ ...inputStyle, fontSize: 'var(--typography-body-sm-size)' }}
            type="text"
            value={key}
            placeholder="key"
            onChange={(e) => updateKey(key, e.target.value)}
          />
          <input
            style={{ ...inputStyle, fontSize: 'var(--typography-body-sm-size)' }}
            type="text"
            value={value}
            placeholder="value"
            onChange={(e) => updateValue(key, e.target.value)}
          />
          <button
            style={removeButtonStyle}
            onClick={() => removeKey(key)}
            title={`Remove input "${key}"`}
            type="button"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        data-part="button"
        data-variant="outlined"
        onClick={addKey}
        style={{ alignSelf: 'flex-start', fontSize: 'var(--typography-body-xs-size)' }}
        type="button"
      >
        + Add input field
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Action-step editor — ConceptActionPicker + inputs list
// ---------------------------------------------------------------------------

const ActionStepEditor: React.FC<{
  value: ActionStep;
  onChange: (v: ActionStep) => void;
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
    <ConceptActionPicker
      value={value.concept && value.action ? { concept: value.concept, action: value.action } : undefined}
      onChange={(v) => onChange({ ...value, concept: v.concept, action: v.action })}
      filter="mutating"
      placeholder="Search concept/action…"
    />
    <ActionInputsEditor
      inputs={value.inputs}
      onChange={(inputs) => onChange({ ...value, inputs })}
    />
  </div>
);

// ---------------------------------------------------------------------------
// UIEvent sub-editor
// ---------------------------------------------------------------------------

const UIEventEditor: React.FC<{
  value: UIEventStep;
  onChange: (v: UIEventStep) => void;
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        style={selectStyle}
        value={value.kind}
        onChange={(e) => onChange({ ...value, kind: e.target.value as UIEventKind })}
      >
        {UI_EVENT_KINDS.map((k) => (
          <option key={k} value={k}>{UI_EVENT_KIND_LABELS[k]}</option>
        ))}
      </select>
      <input
        style={inputStyle}
        type="text"
        value={value.target}
        placeholder={UI_EVENT_KIND_HINTS[value.kind]}
        onChange={(e) => onChange({ ...value, target: e.target.value })}
      />
    </div>
    <input
      style={inputStyle}
      type="text"
      value={value.params}
      placeholder='Params (JSON) — e.g. {"title":"Saved"}'
      onChange={(e) => onChange({ ...value, params: e.target.value })}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Composite step editor
// ---------------------------------------------------------------------------

const CompositeStepRow: React.FC<{
  step: CompositeStep;
  index: number;
  onChange: (updated: CompositeStep) => void;
  onRemove: () => void;
}> = ({ step, index, onChange, onRemove }) => (
  <div style={{
    border: '1px solid var(--palette-outline-variant)',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--spacing-sm)',
    display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)',
  }}>
    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
      <span style={{
        fontSize: 'var(--typography-label-sm-size)',
        color: 'var(--palette-on-surface-variant)',
        minWidth: '24px',
      }}>
        {index + 1}.
      </span>
      <select
        style={selectStyle}
        value={step.mode}
        onChange={(e) => onChange({ ...step, mode: e.target.value as 'action' | 'ui-event' })}
      >
        <option value="action">Action</option>
        <option value="ui-event">UI Event</option>
      </select>
      <button style={removeButtonStyle} onClick={onRemove} title="Remove step" type="button">&times;</button>
    </div>

    {step.mode === 'action' ? (
      <ActionStepEditor
        value={step.action}
        onChange={(action) => onChange({ ...step, action })}
      />
    ) : (
      <UIEventEditor
        value={step.uiEvent}
        onChange={(uiEvent) => onChange({ ...step, uiEvent })}
      />
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Main binding editor
// ---------------------------------------------------------------------------

export interface BindingEditorProps {
  value: BindingValue;
  onChange: (v: BindingValue) => void;
  /** When true, skip the simple-mode collapsed view and always render advanced. */
  alwaysAdvanced?: boolean;
  /** When true, hide the Advanced toggle and mode selector — only Action mode is available. */
  restrictToAction?: boolean;
}

export const BindingEditor: React.FC<BindingEditorProps> = ({
  value,
  onChange,
  alwaysAdvanced = false,
  restrictToAction = false,
}) => {
  const [advanced, setAdvanced] = useState(
    alwaysAdvanced || value.mode === 'ui-event' || value.mode === 'composite',
  );

  const addCompositeStep = useCallback(() => {
    const steps = value.steps ?? [];
    onChange({
      ...value,
      mode: 'composite',
      steps: [
        ...steps,
        {
          mode: 'action',
          action: emptyAction(),
          uiEvent: emptyUIEvent(),
        },
      ],
    });
  }, [value, onChange]);

  const updateCompositeStep = useCallback((idx: number, updated: CompositeStep) => {
    const steps = [...(value.steps ?? [])];
    steps[idx] = updated;
    onChange({ ...value, steps });
  }, [value, onChange]);

  const removeCompositeStep = useCallback((idx: number) => {
    const steps = (value.steps ?? []).filter((_, i) => i !== idx);
    if (steps.length === 0) {
      onChange({ mode: 'action', action: emptyAction() });
    } else {
      onChange({ ...value, steps });
    }
  }, [value, onChange]);

  const switchMode = useCallback((mode: BindingMode) => {
    if (mode === 'action') {
      onChange({ mode: 'action', action: value.action ?? emptyAction() });
    } else if (mode === 'ui-event') {
      onChange({
        mode: 'ui-event',
        uiEvent: value.uiEvent ?? emptyUIEvent(),
      });
    } else {
      onChange({
        mode: 'composite',
        steps: value.steps ?? [],
      });
    }
  }, [value, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1 }}>
      {/* Simple mode: compact ConceptActionPicker + inputs */}
      {!advanced && (
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ActionStepEditor
              value={value.action ?? emptyAction()}
              onChange={(action) => onChange({ mode: 'action', action })}
            />
          </div>
          {!restrictToAction && (
            <button style={advancedToggleStyle} onClick={() => setAdvanced(true)} type="button">
              Advanced
            </button>
          )}
        </div>
      )}

      {/* Advanced mode: binding-kind segmented control + mode-specific fields */}
      {advanced && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {/* Mode selector — hidden when restrictToAction=true */}
          {!restrictToAction && (
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
            {(['action', 'ui-event', 'composite'] as BindingMode[]).map((m) => (
              <button
                key={m}
                data-part="button"
                data-variant={value.mode === m ? 'filled' : 'outlined'}
                onClick={() => switchMode(m)}
                style={{ fontSize: 'var(--typography-body-sm-size)' }}
                type="button"
              >
                {m === 'action' ? 'Action' : m === 'ui-event' ? 'UI Event' : 'Composite'}
              </button>
            ))}
            {!alwaysAdvanced && (
              <button
                style={{ ...advancedToggleStyle, marginLeft: 'auto' }}
                onClick={() => {
                  setAdvanced(false);
                  if (value.mode !== 'action') onChange({ mode: 'action', action: emptyAction() });
                }}
                type="button"
              >
                Simple
              </button>
            )}
          </div>
          )}

          {/* Action mode */}
          {value.mode === 'action' && (
            <ActionStepEditor
              value={value.action ?? emptyAction()}
              onChange={(action) => onChange({ ...value, action })}
            />
          )}

          {/* UI Event mode */}
          {value.mode === 'ui-event' && (
            <UIEventEditor
              value={value.uiEvent ?? emptyUIEvent()}
              onChange={(uiEvent) => onChange({ ...value, uiEvent })}
            />
          )}

          {/* Composite mode */}
          {value.mode === 'composite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {(value.steps ?? []).length === 0 && (
                <div style={{
                  fontSize: 'var(--typography-body-sm-size)',
                  color: 'var(--palette-on-surface-variant)',
                  fontStyle: 'italic',
                }}>
                  No steps yet. Click &quot;+ Add step&quot; to build a sequence.
                </div>
              )}
              {(value.steps ?? []).map((step, idx) => (
                <CompositeStepRow
                  key={idx}
                  step={step}
                  index={idx}
                  onChange={(updated) => updateCompositeStep(idx, updated)}
                  onRemove={() => removeCompositeStep(idx)}
                />
              ))}
              <button
                data-part="button"
                data-variant="outlined"
                onClick={addCompositeStep}
                style={{ alignSelf: 'flex-start', fontSize: 'var(--typography-body-sm-size)' }}
                type="button"
              >
                + Add step
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BindingEditor;
