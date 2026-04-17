'use client';

/**
 * WorkflowBuilder — React adapter for the workflow-builder.widget spec.
 *
 * State-machine editor for creating and editing Workflow records. States are
 * managed as a chip list (one per row). Transitions are structured rows of
 * (from -> event -> to) where from/to are dropdowns over the declared states.
 * The Initial State dropdown is also bound to the declared states.
 *
 * Slug derivation (Workflow ID auto-fill from Display Name) flows through the
 * shared `Slug` concept transformer so the same logic is used by every form
 * across every framework target.
 *
 * Widget spec: surface/widgets/workflow-builder.widget
 * Tier 1a bespoke-editor — accepts mode "create" | "edit" and context as props.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useKernelInvoke, useNavigator } from '../../../lib/clef-provider';
import { slugify } from '../../../lib/slug';

interface WorkflowBuilderProps {
  mode?: 'create' | 'edit';
  context?: Record<string, unknown> | null;
}

interface Transition { from: string; event: string; to: string }

function parseInitialStates(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch { /* ignore */ }
  }
  return [];
}

function parseInitialTransitions(raw: unknown): Transition[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch { /* ignore */ }
  }
  return arr
    .map((t) => {
      const o = t as Record<string, unknown>;
      return {
        from: String(o?.from ?? ''),
        event: String(o?.event ?? ''),
        to: String(o?.to ?? ''),
      };
    })
    .filter((t) => t.from || t.event || t.to);
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  mode = 'create',
  context = null,
}) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const initial = context ?? {};
  const [displayName, setDisplayName] = useState<string>((initial.name as string) ?? '');
  const [workflowId, setWorkflowId] = useState<string>((initial.workflow as string) ?? '');
  const [idManuallyEdited, setIdManuallyEdited] = useState<boolean>(
    Boolean((initial.workflow as string)?.length),
  );
  const [states, setStates] = useState<string[]>(() => parseInitialStates(initial.states));
  const [pendingState, setPendingState] = useState<string>('');
  const [initialState, setInitialState] = useState<string>((initial.initialState as string) ?? '');
  const [transitions, setTransitions] = useState<Transition[]>(() =>
    parseInitialTransitions(initial.transitions),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In edit mode, hydrate state from the existing ContentNode record. The page
  // passes only `{workflow: id}` as context, so we fetch + parse the content
  // JSON to populate the Display Name, states chip list, initial state, and
  // transition rows.
  const needsHydrate = mode === 'edit' && workflowId && states.length === 0;
  useEffect(() => {
    if (!needsHydrate) return;
    let cancelled = false;
    (async () => {
      const r = await invoke('ContentNode', 'get', { node: workflowId });
      if (cancelled) return;
      if (r.variant !== 'ok') return;
      try {
        const parsed = JSON.parse((r.content as string) ?? '{}');
        if (typeof parsed?.name === 'string' && parsed.name) setDisplayName(parsed.name);
        const parsedStates = parseInitialStates(parsed?.states);
        if (parsedStates.length > 0) setStates(parsedStates);
        if (typeof parsed?.initialState === 'string') setInitialState(parsed.initialState);
        const parsedTransitions = parseInitialTransitions(parsed?.transitions);
        if (parsedTransitions.length > 0) setTransitions(parsedTransitions);
      } catch { /* ignore malformed content */ }
    })();
    return () => { cancelled = true; };
  }, [needsHydrate, workflowId, invoke]);

  const stateOptions = useMemo(() => Array.from(new Set(states.filter((s) => s.trim()))), [states]);

  const handleNameChange = (value: string) => {
    setDisplayName(value);
    if (!idManuallyEdited) setWorkflowId(slugify(value));
  };

  const addState = () => {
    const trimmed = pendingState.trim();
    if (!trimmed) return;
    if (states.includes(trimmed)) { setPendingState(''); return; }
    setStates((s) => [...s, trimmed]);
    if (!initialState) setInitialState(trimmed);
    setPendingState('');
  };

  const removeState = (idx: number) => {
    const removed = states[idx];
    setStates((s) => s.filter((_, i) => i !== idx));
    if (initialState === removed) setInitialState('');
    setTransitions((t) => t.filter((tr) => tr.from !== removed && tr.to !== removed));
  };

  const addTransition = () => {
    setTransitions((t) => [...t, { from: stateOptions[0] ?? '', event: '', to: stateOptions[0] ?? '' }]);
  };

  const updateTransition = (idx: number, patch: Partial<Transition>) => {
    setTransitions((t) => t.map((tr, i) => (i === idx ? { ...tr, ...patch } : tr)));
  };

  const removeTransition = (idx: number) => {
    setTransitions((t) => t.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!workflowId.trim()) { setError('Workflow ID is required.'); return; }
    if (states.length === 0) { setError('Add at least one state.'); return; }
    if (!initialState.trim()) { setError('Pick an initial state.'); return; }
    if (!stateOptions.includes(initialState.trim())) {
      setError(`Initial state "${initialState.trim()}" must be one of the declared states.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const content = JSON.stringify({
        name: displayName.trim() || workflowId.trim(),
        states: stateOptions,
        initialState: initialState.trim(),
        transitions,
      });
      const result = await invoke('ContentNode', 'createWithSchema', {
        schema: 'Workflow',
        title: displayName.trim() || workflowId.trim(),
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

  const fieldLabel = { display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 500 } as const;
  const inputStyle = { width: '100%', boxSizing: 'border-box' } as const;

  return (
    <div data-part="root" data-mode={mode} style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--spacing-xl)' }}>
      <h1 style={{ marginBottom: 'var(--spacing-lg)' }}>
        {mode === 'create' ? 'Create Workflow' : 'Edit Workflow'}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <label>
          <span style={fieldLabel}>Display Name</span>
          <input
            value={displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Article Review"
            style={inputStyle}
          />
        </label>

        <label>
          <span style={fieldLabel}>Workflow ID *</span>
          <input
            data-part="workflowIdInput"
            value={workflowId}
            onChange={(e) => { setWorkflowId(e.target.value); setIdManuallyEdited(true); }}
            placeholder={!idManuallyEdited && displayName ? 'auto-derived from name (editable)' : 'e.g. article-review'}
            disabled={mode === 'edit'}
            style={{
              ...inputStyle,
              fontStyle: !idManuallyEdited && workflowId ? 'italic' : 'normal',
              color: !idManuallyEdited && workflowId ? 'var(--palette-on-surface-variant, #6b7280)' : 'inherit',
            }}
          />
        </label>

        <div>
          <span style={fieldLabel}>States *</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-sm)' }}>
            {states.map((s, i) => (
              <span key={`${s}-${i}`} data-part="stateChip" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--palette-primary-container, #dbeafe)',
                color: 'var(--palette-on-primary-container, #1e3a8a)',
                padding: '2px 6px 2px 10px', borderRadius: 999, fontSize: 13,
              }}>
                {s}
                <button
                  type="button"
                  aria-label={`Remove state ${s}`}
                  onClick={() => removeState(i)}
                  style={{
                    border: 'none', background: 'transparent', color: 'inherit',
                    cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1,
                  }}
                >×</button>
              </span>
            ))}
            {states.length === 0 && (
              <span style={{ color: 'var(--palette-on-surface-variant, #6b7280)', fontSize: 13 }}>
                No states yet — add one below.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            <input
              data-part="statesInput"
              value={pendingState}
              onChange={(e) => setPendingState(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addState();
                }
              }}
              placeholder="State name (press Enter)"
              style={inputStyle}
            />
            <button
              type="button"
              data-part="button"
              data-variant="outlined"
              onClick={addState}
              disabled={!pendingState.trim()}
            >
              Add
            </button>
          </div>
        </div>

        <label>
          <span style={fieldLabel}>Initial State *</span>
          <select
            data-part="initialStateInput"
            value={initialState}
            onChange={(e) => setInitialState(e.target.value)}
            style={inputStyle}
            disabled={stateOptions.length === 0}
          >
            <option value="">{stateOptions.length === 0 ? 'Add a state first' : 'Select…'}</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <div>
          <span style={fieldLabel}>Transitions</span>
          {transitions.length === 0 && (
            <p style={{ margin: '0 0 var(--spacing-sm)', color: 'var(--palette-on-surface-variant, #6b7280)', fontSize: 13 }}>
              No transitions yet — add one to define how states flow.
            </p>
          )}
          {transitions.map((t, i) => (
            <div
              key={i}
              data-part="transitionRow"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr auto 1fr auto',
                gap: 'var(--spacing-xs)',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              <select value={t.from} onChange={(e) => updateTransition(i, { from: e.target.value })}>
                <option value="">from…</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span style={{ color: 'var(--palette-on-surface-variant, #6b7280)' }}>—</span>
              <input
                value={t.event}
                onChange={(e) => updateTransition(i, { event: e.target.value })}
                placeholder="event name"
              />
              <span style={{ color: 'var(--palette-on-surface-variant, #6b7280)' }}>→</span>
              <select value={t.to} onChange={(e) => updateTransition(i, { to: e.target.value })}>
                <option value="">to…</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                type="button"
                aria-label="Remove transition"
                onClick={() => removeTransition(i)}
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
            onClick={addTransition}
            disabled={stateOptions.length === 0}
          >
            + Add transition
          </button>
        </div>

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
