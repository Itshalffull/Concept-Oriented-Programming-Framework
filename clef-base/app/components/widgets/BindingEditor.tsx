'use client';

/**
 * BindingEditor — Reusable editor for a single action/UI-event binding.
 *
 * Supports three binding modes via progressive disclosure:
 *   Action       — wraps an existing ActionBinding reference id
 *   UI Event     — wraps a UIEventBinding (9 canonical surface effects)
 *   Composite    — ordered list of Action/UIEvent steps invoked in sequence
 *
 * Used by SlotSourceEditor (ComponentMapping action bindings),
 * AutomationRuleBuilder (output actions), WorkflowBuilder (transition
 * effects), and ViewEditor (rowClick / rowActions).
 */

import React, { useCallback, useState } from 'react';

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

export interface CompositeStep {
  mode: 'action' | 'ui-event';
  actionRef: string;     // used when mode='action'
  uiEvent: UIEventStep;  // used when mode='ui-event'
}

/** Serialised form stored in the ComponentMapping binding field */
export interface BindingValue {
  mode: BindingMode;
  /** ActionBinding reference id — only for mode='action' */
  actionRef?: string;
  /** UIEvent config — only for mode='ui-event' */
  uiEvent?: UIEventStep;
  /** Ordered steps — only for mode='composite' */
  steps?: CompositeStep[];
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
      <input
        style={inputStyle}
        type="text"
        value={step.actionRef}
        placeholder="ActionBinding reference id"
        onChange={(e) => onChange({ ...step, actionRef: e.target.value })}
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
// Main binding editor for a single action-binding row
// ---------------------------------------------------------------------------

export interface BindingEditorProps {
  value: BindingValue;
  onChange: (v: BindingValue) => void;
}

export const BindingEditor: React.FC<BindingEditorProps> = ({ value, onChange }) => {
  const [advanced, setAdvanced] = useState(
    value.mode === 'ui-event' || value.mode === 'composite',
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
          actionRef: '',
          uiEvent: { kind: 'navigate', target: '', params: '{}' },
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
    // Downgrade to simpler mode if steps run out
    if (steps.length === 0) {
      onChange({ mode: 'action', actionRef: '' });
    } else {
      onChange({ ...value, steps });
    }
  }, [value, onChange]);

  const switchMode = useCallback((mode: BindingMode) => {
    if (mode === 'action') {
      onChange({ mode: 'action', actionRef: value.actionRef ?? '' });
    } else if (mode === 'ui-event') {
      onChange({
        mode: 'ui-event',
        uiEvent: value.uiEvent ?? { kind: 'navigate', target: '', params: '{}' },
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
      {/* Simple mode: just an ActionBinding reference text input */}
      {!advanced && (
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
          <input
            style={inputStyle}
            type="text"
            value={value.mode === 'action' ? (value.actionRef ?? '') : ''}
            placeholder="ActionBinding reference (or leave blank for Unbound)"
            onChange={(e) => onChange({ mode: 'action', actionRef: e.target.value })}
          />
          <button style={advancedToggleStyle} onClick={() => setAdvanced(true)} type="button">
            Advanced
          </button>
        </div>
      )}

      {/* Advanced mode: binding-kind segmented control + mode-specific fields */}
      {advanced && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {/* Mode selector */}
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
            <button
              style={{ ...advancedToggleStyle, marginLeft: 'auto' }}
              onClick={() => {
                setAdvanced(false);
                if (value.mode !== 'action') onChange({ mode: 'action', actionRef: '' });
              }}
              type="button"
            >
              Simple
            </button>
          </div>

          {/* Action mode */}
          {value.mode === 'action' && (
            <input
              style={inputStyle}
              type="text"
              value={value.actionRef ?? ''}
              placeholder="ActionBinding reference id"
              onChange={(e) => onChange({ ...value, actionRef: e.target.value })}
            />
          )}

          {/* UI Event mode */}
          {value.mode === 'ui-event' && (
            <UIEventEditor
              value={value.uiEvent ?? { kind: 'navigate', target: '', params: '{}' }}
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
