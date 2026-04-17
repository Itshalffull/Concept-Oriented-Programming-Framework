'use client';

/**
 * AutomationRuleBuilder — React adapter for the automation-rule-builder.widget spec.
 *
 * Event-condition-action (ECA) rule editor for creating and editing AutomationRule
 * records. The user picks a Trigger (Concept/action), optionally adds predicate
 * Conditions (field/op/value rows), and one or more output Actions (each a
 * Concept/action plus a JSON input map).
 *
 * Slug derivation (Rule ID auto-fill from Trigger or Display Name) flows through
 * the shared `Slug` concept transformer (lib/slug.ts).
 *
 * Widget spec: surface/widgets/automation-rule-builder.widget
 * Tier 1a bespoke-editor — accepts mode "create" | "edit" and context as props.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useKernelInvoke, useNavigator } from '../../../lib/clef-provider';
import { slugify } from '../../../lib/slug';
import {
  BindingEditor,
  emptyBindingValue,
  migrateBindingValue,
  type BindingValue,
} from './BindingEditor';
import { ConceptActionPicker } from './ConceptActionPicker';

interface AutomationRuleBuilderProps {
  mode?: 'create' | 'edit';
  context?: Record<string, unknown> | null;
}

interface Condition { field: string; op: string; value: string }
/**
 * An action row stores a BindingValue so it supports all three binding kinds
 * (Action, UI Event, Composite). Legacy rows of shape
 * `{concept, action, input}` are migrated on hydrate; on save we serialise
 * back to the canonical `{concept, action, input}` shape for Action-mode
 * rows so existing downstream consumers keep working.
 */
interface ActionRow { binding: BindingValue }

/** Back-compat shape persisted for Action-mode rows. */
interface LegacyActionRow { concept: string; action: string; input: Record<string, string> }

const COMPARISON_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'in', 'exists'];

function parseConditions(raw: unknown): Condition[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch { /* ignore */ }
  }
  return arr.map((c) => {
    const o = c as Record<string, unknown>;
    return { field: String(o?.field ?? ''), op: String(o?.op ?? 'eq'), value: String(o?.value ?? '') };
  });
}

function parseActions(raw: unknown): ActionRow[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch { /* ignore */ }
  }
  return arr.map((a) => {
    const o = a as Record<string, unknown>;
    // Modern shape: {binding: BindingValue}
    if (o && typeof o === 'object' && 'binding' in o && o.binding && typeof o.binding === 'object') {
      return { binding: migrateBindingValue(o.binding) };
    }
    // Modern shape (inlined mode/action/uiEvent/steps): already a BindingValue
    if (o && typeof o === 'object' && 'mode' in o) {
      return { binding: migrateBindingValue(o) };
    }
    // Legacy: {concept, action, input} — migrate to Action-mode BindingValue
    const input = (o?.input as Record<string, unknown>) ?? {};
    const inputStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(input)) {
      inputStr[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return {
      binding: {
        mode: 'action',
        action: {
          concept: String(o?.concept ?? ''),
          action: String(o?.action ?? ''),
          inputs: inputStr,
        },
      },
    };
  });
}

/**
 * Serialise an ActionRow for persistence. Action-mode rows keep the
 * legacy `{concept, action, input}` shape so existing rule consumers
 * continue to work. UI-event and composite rows are stored as the full
 * BindingValue inside a `binding` field.
 */
function serializeActionRow(row: ActionRow): Record<string, unknown> | LegacyActionRow {
  const { binding } = row;
  if (binding.mode === 'action' && binding.action) {
    return {
      concept: binding.action.concept,
      action: binding.action.action,
      input: binding.action.inputs,
    };
  }
  return { binding };
}

/** True iff the BindingValue has enough to persist. */
function isBindingValid(binding: BindingValue): boolean {
  if (binding.mode === 'action') {
    return !!(binding.action?.concept && binding.action?.action);
  }
  if (binding.mode === 'ui-event') {
    return !!binding.uiEvent?.kind;
  }
  return (binding.steps ?? []).length > 0;
}

export const AutomationRuleBuilder: React.FC<AutomationRuleBuilderProps> = ({
  mode = 'create',
  context = null,
}) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const initial = context ?? {};
  const [displayName, setDisplayName] = useState<string>((initial.name as string) ?? '');
  const [ruleId, setRuleId] = useState<string>((initial.rule as string) ?? '');
  const [ruleIdManuallyEdited, setRuleIdManuallyEdited] = useState<boolean>(
    Boolean((initial.rule as string)?.length),
  );

  // Trigger — a Concept/action pair. Stored as "Concept/action" string for save.
  const initialTriggerParts = (() => {
    const t = (initial.trigger as string) ?? '';
    const parts = t.split('/');
    return parts.length === 2 ? { concept: parts[0], action: parts[1] } : undefined;
  })();
  const [trigger, setTrigger] = useState<{ concept: string; action: string } | undefined>(initialTriggerParts);

  const [conditions, setConditions] = useState<Condition[]>(() => parseConditions(initial.conditions));
  const [actions, setActions] = useState<ActionRow[]>(() => parseActions(initial.actions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In edit mode, hydrate state from the existing ContentNode record. The page
  // passes only `{rule: <id>}` as context, so we fetch + parse the content
  // JSON to populate Display Name, Trigger pair, Conditions, and Actions rows.
  const needsHydrate = mode === 'edit' && ruleId && !trigger && actions.length === 0;
  useEffect(() => {
    if (!needsHydrate) return;
    let cancelled = false;
    (async () => {
      const nodeId = ruleId.startsWith('automation-rule:') ? ruleId : `automation-rule:${ruleId}`;
      const r = await invoke('ContentNode', 'get', { node: nodeId });
      if (cancelled || r.variant !== 'ok') return;
      try {
        const parsed = JSON.parse((r.content as string) ?? '{}');
        if (typeof parsed?.name === 'string' && parsed.name) setDisplayName(parsed.name);
        if (typeof parsed?.trigger === 'string' && parsed.trigger.includes('/')) {
          const [concept, action] = parsed.trigger.split('/');
          setTrigger({ concept, action });
        }
        const parsedConditions = parseConditions(parsed?.conditions);
        if (parsedConditions.length > 0) setConditions(parsedConditions);
        const parsedActions = parseActions(parsed?.actions);
        if (parsedActions.length > 0) setActions(parsedActions);
      } catch { /* ignore malformed content */ }
    })();
    return () => { cancelled = true; };
  }, [needsHydrate, ruleId, invoke]);

  // When trigger is selected and ID hasn't been manually edited, derive Rule ID
  // from "<concept>-<action>". When user types Display Name, derive from that.
  const handleTriggerChange = (value: { concept: string; action: string }) => {
    setTrigger(value);
    if (!ruleIdManuallyEdited && !displayName.trim()) {
      setRuleId(slugify(`${value.concept}-${value.action}`));
    }
  };

  const handleNameChange = (value: string) => {
    setDisplayName(value);
    if (!ruleIdManuallyEdited) {
      setRuleId(slugify(value));
    }
  };

  const triggerLabel = useMemo(
    () => (trigger ? `${trigger.concept}/${trigger.action}` : ''),
    [trigger],
  );

  const addCondition = () => setConditions((c) => [...c, { field: '', op: 'eq', value: '' }]);
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions((c) => c.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeCondition = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i));

  const addAction = () => setActions((a) => [...a, { binding: emptyBindingValue() }]);
  const updateActionBinding = (i: number, binding: BindingValue) =>
    setActions((a) => a.map((row, idx) => (idx === i ? { binding } : row)));
  const removeAction = (i: number) => setActions((a) => a.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!ruleId.trim()) { setError('Rule ID is required.'); return; }
    if (!trigger) { setError('Trigger is required.'); return; }
    const validActions = actions.filter((a) => isBindingValid(a.binding));
    if (validActions.length === 0) { setError('Add at least one action.'); return; }

    setSaving(true);
    setError(null);
    try {
      const validConditions = conditions.filter((c) => c.field && c.op);
      const serializedActions = validActions.map(serializeActionRow);
      if (mode === 'create') {
        const content = JSON.stringify({
          name: displayName.trim() || ruleId.trim(),
          trigger: triggerLabel,
          conditions: validConditions,
          actions: serializedActions,
          enabled: false,
        });
        const result = await invoke('ContentNode', 'createWithSchema', {
          schema: 'AutomationRule',
          title: displayName.trim() || ruleId.trim(),
          node: 'automation-rule:' + ruleId.trim(),
          content,
        });
        if (result.variant !== 'ok') {
          setError(String(result.message ?? `Unexpected variant: ${result.variant}`));
          return;
        }
      } else {
        const result = await invoke('AutomationRule', 'update', {
          rule: ruleId.trim(),
          trigger: triggerLabel,
          conditions: JSON.stringify(validConditions),
          actions: JSON.stringify(serializedActions),
        });
        if (result.variant !== 'ok' && result.variant !== 'updated') {
          setError(String(result.message ?? `Unexpected variant: ${result.variant}`));
          return;
        }
      }
      navigateToHref('/admin/automations/rules');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel = { display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 } as const;
  const inputStyle = { width: '100%', boxSizing: 'border-box' } as const;

  return (
    <div data-part="root" data-mode={mode} style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--spacing-xl)' }}>
      <h1 style={{ marginBottom: 'var(--spacing-lg)' }}>
        {mode === 'create' ? 'Create Automation Rule' : 'Edit Automation Rule'}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <label>
          <span style={fieldLabel}>Display Name</span>
          <input
            value={displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Notify on publish"
            style={inputStyle}
          />
        </label>

        <label>
          <span style={fieldLabel}>Rule ID *</span>
          <input
            data-part="ruleIdInput"
            value={ruleId}
            onChange={(e) => { setRuleId(e.target.value); setRuleIdManuallyEdited(true); }}
            placeholder={
              !ruleIdManuallyEdited && (displayName || trigger)
                ? 'auto-derived (editable)'
                : 'e.g. notify-on-publish'
            }
            disabled={mode === 'edit'}
            style={{
              ...inputStyle,
              fontStyle: !ruleIdManuallyEdited && ruleId ? 'italic' : 'normal',
              color: !ruleIdManuallyEdited && ruleId ? 'var(--palette-on-surface-variant, #6b7280)' : 'inherit',
            }}
          />
        </label>

        <div>
          <span style={fieldLabel}>Trigger Event *</span>
          <ConceptActionPicker
            value={trigger}
            onChange={handleTriggerChange}
            filter="mutating"
            placeholder="Search trigger concept/action…"
          />
        </div>

        <div>
          <span style={fieldLabel}>Conditions</span>
          {conditions.length === 0 && (
            <p style={{ margin: '0 0 var(--spacing-sm)', color: 'var(--palette-on-surface-variant, #6b7280)', fontSize: 13 }}>
              No conditions — rule fires on every trigger event.
            </p>
          )}
          {conditions.map((c, i) => (
            <div
              key={i}
              data-part="conditionRow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 8rem 1fr auto',
                gap: 'var(--spacing-xs)',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              <input
                value={c.field}
                onChange={(e) => updateCondition(i, { field: e.target.value })}
                placeholder="field path"
              />
              <select value={c.op} onChange={(e) => updateCondition(i, { op: e.target.value })}>
                {COMPARISON_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <input
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder="value"
              />
              <button
                type="button"
                aria-label="Remove condition"
                onClick={() => removeCondition(i)}
                style={{
                  border: 'none', background: 'transparent',
                  cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1,
                  color: 'var(--palette-on-surface-variant, #6b7280)',
                }}
              >×</button>
            </div>
          ))}
          <button
            type="button"
            data-part="button"
            data-variant="outlined"
            onClick={addCondition}
          >
            + Add condition
          </button>
        </div>

        <div>
          <span style={fieldLabel}>Actions *</span>
          {actions.length === 0 && (
            <p style={{ margin: '0 0 var(--spacing-sm)', color: 'var(--palette-on-surface-variant, #6b7280)', fontSize: 13 }}>
              No actions — add one to define what the rule does.
            </p>
          )}
          {actions.map((a, i) => (
            <div
              key={i}
              data-part="actionRow"
              style={{
                border: '1px solid var(--palette-outline-variant, #e5e7eb)',
                borderRadius: 'var(--radius-sm, 6px)',
                padding: 'var(--spacing-sm, 8px)',
                marginBottom: 'var(--spacing-sm, 8px)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Action {i + 1}</span>
                <button
                  type="button"
                  aria-label={`Remove action ${i + 1}`}
                  onClick={() => removeAction(i)}
                  style={{
                    border: 'none', background: 'transparent',
                    cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1,
                    color: 'var(--palette-on-surface-variant, #6b7280)',
                  }}
                >×</button>
              </div>
              <BindingEditor
                value={a.binding}
                onChange={(binding) => updateActionBinding(i, binding)}
              />
            </div>
          ))}
          <button
            type="button"
            data-part="button"
            data-variant="outlined"
            onClick={addAction}
          >
            + Add action
          </button>
        </div>

        {error && (
          <p role="alert" style={{ color: 'var(--palette-error)', margin: 0 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
          <button
            data-part="button"
            data-variant="outlined"
            onClick={() => navigateToHref('/admin/automations/rules')}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            data-part="button"
            data-variant="filled"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Rule' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutomationRuleBuilder;
