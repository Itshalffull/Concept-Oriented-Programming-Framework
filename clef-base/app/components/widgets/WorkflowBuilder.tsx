'use client';

/**
 * WorkflowBuilder — React adapter for the workflow-builder.widget spec.
 *
 * State-machine editor for creating and editing Workflow records. Presents a
 * two-panel layout: a states list on the left and a transitions grid on the
 * right. initialState must reference a state in the states list.
 *
 * Widget spec: surface/widgets/workflow-builder.widget
 * Tier 1a bespoke-editor — accepts mode "create" | "edit" and context as props.
 *
 * This is a minimal stub. Full interactive state/transition graph editing
 * (drag-and-drop states, inline transition rows, dangling-reference guards)
 * is a follow-up iteration.
 */

import React, { useState } from 'react';
import { useKernelInvoke, useNavigator } from '../../../lib/clef-provider';

interface WorkflowBuilderProps {
  mode?: 'create' | 'edit';
  context?: Record<string, unknown> | null;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  mode = 'create',
  context = null,
}) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const initial = context ?? {};
  const [workflowId, setWorkflowId] = useState<string>((initial.workflow as string) ?? '');
  const [initialState, setInitialState] = useState<string>((initial.initialState as string) ?? '');
  const [statesRaw, setStatesRaw] = useState<string>((initial.states as string) ?? '');
  const [transitionsRaw, setTransitionsRaw] = useState<string>((initial.transitions as string) ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!workflowId.trim()) { setError('Workflow ID is required.'); return; }
    if (!initialState.trim()) { setError('Initial state is required.'); return; }

    // Parse states to validate that initialState is present
    let stateNames: string[] = [];
    if (statesRaw.trim()) {
      try {
        const parsed = JSON.parse(statesRaw);
        stateNames = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        setError('States must be a valid JSON array of state name strings.');
        return;
      }
    }
    if (stateNames.length > 0 && !stateNames.includes(initialState.trim())) {
      setError(`Initial state "${initialState.trim()}" is not in the states list.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const content = JSON.stringify({
        name: workflowId.trim(),
        states: stateNames.length > 0 ? stateNames : [initialState.trim()],
        initialState: initialState.trim(),
        transitions: transitionsJson.trim() || '[]',
      });
      const result = await invoke('ContentNode', 'createWithSchema', {
        schema: 'Workflow',
        title: workflowId.trim(),
        node: 'workflow:' + workflowId.trim(),
        content,
      });
      if (result.variant !== 'ok') {
        setError(String(result.message ?? `Unexpected variant: ${result.variant}`));
        return;
      }
      navigateToHref('/admin/workflows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-part="root" data-mode={mode} style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--spacing-xl)' }}>
      <h1 style={{ marginBottom: 'var(--spacing-lg)' }}>
        {mode === 'create' ? 'Create Workflow' : 'Edit Workflow'}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Workflow ID *</span>
          <input
            data-part="workflowIdInput"
            value={workflowId}
            onChange={(e) => setWorkflowId(e.target.value)}
            placeholder="e.g. article-review"
            disabled={mode === 'edit'}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Initial State *</span>
          <input
            data-part="initialStateInput"
            value={initialState}
            onChange={(e) => setInitialState(e.target.value)}
            placeholder="e.g. draft"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>States</span>
          <textarea
            data-part="statesInput"
            value={statesRaw}
            onChange={(e) => setStatesRaw(e.target.value)}
            rows={3}
            placeholder='JSON array, e.g. ["draft","in-review","approved","published"]'
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.875rem' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 }}>Transitions</span>
          <textarea
            data-part="transitionsInput"
            value={transitionsRaw}
            onChange={(e) => setTransitionsRaw(e.target.value)}
            rows={4}
            placeholder='JSON array, e.g. [{"from":"draft","event":"submit","to":"in-review"}]'
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
            onClick={() => navigateToHref('/admin/workflows')}
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
            {saving ? 'Saving…' : mode === 'create' ? 'Create Workflow' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;
