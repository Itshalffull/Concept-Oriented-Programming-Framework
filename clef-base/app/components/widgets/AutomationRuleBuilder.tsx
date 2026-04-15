'use client';

/**
 * AutomationRuleBuilder — React adapter for the automation-rule-builder.widget spec.
 *
 * Event-condition-action (ECA) rule editor for creating and editing AutomationRule
 * records. Walks the user through three sequential phases: trigger selection,
 * condition list, and output action definitions.
 *
 * Widget spec: surface/widgets/automation-rule-builder.widget
 * Tier 1a bespoke-editor — accepts mode "create" | "edit" and context as props.
 *
 * This is a minimal stub. Full ECA authoring UI (concept/action picker, predicate
 * rows, multi-action output) is a follow-up iteration.
 */

import React, { useState } from 'react';
import { useKernelInvoke, useNavigator } from '../../../lib/clef-provider';

interface AutomationRuleBuilderProps {
  mode?: 'create' | 'edit';
  context?: Record<string, unknown> | null;
}

export const AutomationRuleBuilder: React.FC<AutomationRuleBuilderProps> = ({
  mode = 'create',
  context = null,
}) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const initial = context ?? {};
  const [ruleId, setRuleId] = useState<string>((initial.rule as string) ?? '');
  const [trigger, setTrigger] = useState<string>((initial.trigger as string) ?? '');
  const [conditions, setConditions] = useState<string>((initial.conditions as string) ?? '');
  const [actions, setActions] = useState<string>((initial.actions as string) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!ruleId.trim()) { setError('Rule ID is required.'); return; }
    if (!trigger.trim()) { setError('Trigger is required.'); return; }
    if (!actions.trim()) { setError('At least one action is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      const result = await invoke('AutomationRule', mode === 'create' ? 'define' : 'update', {
        rule: ruleId.trim(),
        trigger: trigger.trim(),
        conditions: conditions.trim(),
        actions: actions.trim(),
      });
      if (result.variant !== 'ok' && result.variant !== 'updated') {
        setError(String(result.message ?? `Unexpected variant: ${result.variant}`));
        return;
      }
      navigateToHref('/admin/automations/rules');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-part="root" data-mode={mode} style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--spacing-xl)' }}>
      <h1 style={{ marginBottom: 'var(--spacing-lg)' }}>
        {mode === 'create' ? 'Create Automation Rule' : 'Edit Automation Rule'}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Rule ID *</span>
          <input
            data-part="ruleIdInput"
            value={ruleId}
            onChange={(e) => setRuleId(e.target.value)}
            placeholder="e.g. notify-on-publish"
            disabled={mode === 'edit'}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Trigger Event *</span>
          <input
            data-part="triggerInput"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="e.g. ContentNode/create"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Conditions</span>
          <textarea
            data-part="conditionsInput"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={3}
            placeholder='JSON predicate rows, e.g. [{"field":"kind","op":"eq","value":"article"}]'
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Actions *</span>
          <textarea
            data-part="actionsInput"
            value={actions}
            onChange={(e) => setActions(e.target.value)}
            rows={4}
            placeholder='JSON action list, e.g. [{"concept":"Notification","action":"send","input":{"message":"Published"}}]'
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
          />
        </label>

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
