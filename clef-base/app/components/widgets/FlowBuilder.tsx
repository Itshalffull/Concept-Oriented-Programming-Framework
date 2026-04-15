'use client';

/**
 * FlowBuilder — React adapter for the flow-builder.widget spec.
 *
 * Three-pane shell for authoring ProcessSpec workflows. Composes:
 *   - flow-steps-view (left pane in Steps mode, center scroll list)
 *   - FlowchartEditor canvas host (center pane in Graph mode)
 *   - flow-step-inspector (right inspector with action-editor, data-mapping,
 *     error-branch tabs)
 *
 * Widget spec: surface/widgets/flow-builder.widget
 * Anatomy parts (data-part): root, palette, paletteItem, viewToggle,
 *   centerPane, inspector
 *
 * FSM states:
 *   interaction: idle | dragging-from-palette | step-selected | graph-selected
 *   view: steps | graph
 *
 * All action invocations go through useKernelInvoke. No direct state beyond
 * FSM props and per-render data fetched from the kernel.
 *
 * The Graph pane embeds a FlowchartEditor canvas host supplied by
 * repertoire/concepts/diagramming. This component renders it as a Canvas
 * host region bound to processSpecId; the kernel routes canvas events through
 * ProcessSpec/addStep and ProcessSpec/moveStep via syncs.
 *
 * Section 16.12 — widget spec states / connect blocks.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { ActionButton } from './ActionButton';
import {
  ConceptActionPicker,
  type ConceptActionPickerValue,
  type ConceptActionSpec,
} from './ConceptActionPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** FSM interaction states — mirror the widget spec states.interaction block */
type InteractionState =
  | 'idle'
  | 'dragging-from-palette'
  | 'step-selected'
  | 'graph-selected';

/** FSM view states — mirror the widget spec states.view block */
type ViewState = 'steps' | 'graph';

/** Node type entries shown in the left palette */
interface PaletteEntry {
  nodeType: 'trigger' | 'action' | 'branch' | 'catch' | 'logic';
  label: string;
  description: string;
}

/** A single step fetched from ProcessSpec/getSteps */
interface StepRecord {
  stepId: string;
  stepKind: string;
  stepLabel: string;
  stepIndex: number;
  isCollapsible: boolean;
  isCollapsed: boolean;
  parentId?: string;
  config?: string;
}

export interface FlowBuilderProps {
  processSpecId: string;
  /** Controlled: initial view mode */
  initialView?: ViewState;
  /** Controlled: caller can observe selection changes */
  onStepSelected?: (stepId: string | null) => void;
  mode?: 'create' | 'edit';
  context?: { processSpecId?: string; steps?: StepRecord[] } | null;
}

// ---------------------------------------------------------------------------
// Palette entries — static node type catalogue
// ---------------------------------------------------------------------------

const PALETTE_ENTRIES: PaletteEntry[] = [
  { nodeType: 'trigger',  label: 'Trigger',  description: 'Entry point that starts the flow' },
  { nodeType: 'action',   label: 'Action',   description: 'Invoke a concept action' },
  { nodeType: 'branch',   label: 'Branch',   description: 'Conditional fork in the flow' },
  { nodeType: 'catch',    label: 'Catch',    description: 'Error handler for upstream steps' },
  { nodeType: 'logic',    label: 'Logic',    description: 'Data transformation or mapping step' },
];

// ---------------------------------------------------------------------------
// StepsView — inline linear list for the Steps pane
// ---------------------------------------------------------------------------

interface StepsViewProps {
  processSpecId: string;
  selectedStepId: string | null;
  collapsedBranches: string[];
  steps: StepRecord[];
  onSelect: (stepId: string) => void;
  onInsertAt: (index: number) => void;
  onToggleCollapse: (stepId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

const StepsView: React.FC<StepsViewProps> = ({
  processSpecId,
  selectedStepId,
  collapsedBranches,
  steps,
  onSelect,
  onInsertAt,
  onToggleCollapse,
}) => {
  if (steps.length === 0) {
    return (
      <div
        data-part="root"
        data-state="idle"
        data-process-spec-id={processSpecId}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-xl)',
          color: 'var(--palette-on-surface-variant)',
          fontSize: 'var(--typography-body-sm-size)',
          textAlign: 'center',
        }}
        role="region"
        aria-label="Process steps"
      >
        <p>No steps yet.</p>
        <p>Drag a node type from the palette to begin.</p>
        {/* Insert at beginning */}
        <button
          data-part="insert-handle"
          data-index={0}
          style={{ marginTop: 'var(--spacing-sm)', cursor: 'pointer' }}
          onClick={() => onInsertAt(0)}
          aria-label="Insert step at position 0"
        >
          + Add first step
        </button>
      </div>
    );
  }

  const topLevel = steps.filter(s => !s.parentId);

  return (
    <div
      data-part="root"
      data-state="idle"
      data-process-spec-id={processSpecId}
      role="region"
      aria-label="Process steps"
      style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-sm)' }}
    >
      <ol
        data-part="step-list"
        role="list"
        aria-label="Steps"
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
      >
        {/* Insert handle before first step */}
        <li>
          <button
            data-part="insert-handle"
            data-index={0}
            onClick={() => onInsertAt(0)}
            aria-label="Insert step before position 0"
            style={{
              width: '100%',
              height: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              outline: 'none',
            }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === '+' || e.key === 'Enter') onInsertAt(0);
            }}
          />
        </li>

        {topLevel.map((step, idx) => {
          const isSelected = step.stepId === selectedStepId;
          const isCollapsed = collapsedBranches.includes(step.stepId);
          const children = steps.filter(s => s.parentId === step.stepId);

          return (
            <React.Fragment key={step.stepId}>
              <li
                data-part="step-item"
                data-step-id={step.stepId}
                data-step-kind={step.stepKind}
                data-collapsed={isCollapsed ? 'true' : 'false'}
                role="listitem"
                aria-current={isSelected ? 'true' : 'false'}
                aria-label={`${step.stepKind} step: ${step.stepLabel}`}
                aria-expanded={step.isCollapsible ? (!isCollapsed ? 'true' : 'false') : undefined}
                tabIndex={0}
                onClick={() => onSelect(step.stepId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(step.stepId);
                }}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isSelected ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
                  background: isSelected ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {/* Step header */}
                <div
                  data-part="step-header"
                  data-step-id={step.stepId}
                  role="group"
                  aria-label={`Step header: ${step.stepLabel}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    padding: '6px var(--spacing-sm)',
                  }}
                >
                  {/* Drag handle */}
                  <span
                    data-part="reorder-handle"
                    data-step-id={step.stepId}
                    draggable
                    aria-label={`Reorder step: ${step.stepLabel}`}
                    aria-roledescription="drag handle"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'grab', opacity: 0.5, fontSize: '10px', userSelect: 'none' }}
                  >
                    ⠿
                  </span>

                  {/* Kind badge */}
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-xs, 2px)',
                      background: 'var(--palette-secondary-container)',
                      color: 'var(--palette-on-secondary-container)',
                      fontFamily: 'var(--typography-font-family-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {step.stepKind}
                  </span>

                  {/* Label */}
                  <span style={{ flex: 1, fontSize: 'var(--typography-body-sm-size)', fontWeight: isSelected ? 600 : undefined }}>
                    {step.stepLabel}
                  </span>

                  {/* Collapse toggle for branch steps */}
                  {step.isCollapsible && (
                    <button
                      data-part="collapse-toggle"
                      data-step-id={step.stepId}
                      aria-label={isCollapsed ? 'Expand branch' : 'Collapse branch'}
                      aria-expanded={isCollapsed ? 'false' : 'true'}
                      onClick={(e) => { e.stopPropagation(); onToggleCollapse(step.stepId); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}
                    >
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                  )}
                </div>

                {/* Nested children */}
                {!isCollapsed && children.length > 0 && (
                  <ol
                    role="list"
                    style={{ listStyle: 'none', margin: '0 0 4px 20px', padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
                  >
                    {children.map((child) => (
                      <li
                        key={child.stepId}
                        data-part="step-item"
                        data-step-id={child.stepId}
                        data-step-kind={child.stepKind}
                        data-collapsed="false"
                        role="listitem"
                        aria-current={child.stepId === selectedStepId ? 'true' : 'false'}
                        aria-label={`${child.stepKind} step: ${child.stepLabel}`}
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onSelect(child.stepId); }}
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${child.stepId === selectedStepId ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
                          background: child.stepId === selectedStepId ? 'var(--palette-primary-container)' : 'var(--palette-surface-variant)',
                          padding: '4px var(--spacing-sm)',
                          cursor: 'pointer',
                          fontSize: 'var(--typography-body-sm-size)',
                        }}
                      >
                        <span style={{ opacity: 0.6, fontSize: '10px', marginRight: 4 }}>{child.stepKind}</span>
                        {child.stepLabel}
                      </li>
                    ))}
                  </ol>
                )}
              </li>

              {/* Insert handle after this step */}
              <li>
                <button
                  data-part="insert-handle"
                  data-index={idx + 1}
                  onClick={() => onInsertAt(idx + 1)}
                  aria-label={`Insert step after position ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === '+' || e.key === 'Enter') onInsertAt(idx + 1);
                  }}
                />
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FlowchartEditorHost — Canvas host for the Graph pane
// ---------------------------------------------------------------------------

interface FlowchartEditorHostProps {
  processSpecId: string;
  selectedNodeId: string | null;
  onNodeSelected: (nodeId: string) => void;
}

/**
 * FlowchartEditorHost wraps the Canvas concept's host region for the graph
 * pane. Canvas/mount is called with the processSpecId as the canvas scope;
 * Canvas nodes map 1:1 to ProcessSpec steps. Node selection events are
 * surfaced upward so the inspector stays in sync across both views.
 *
 * The host element uses data-part="flowchart-editor-host" so the kernel's
 * Canvas concept can locate it via DOM attachment.
 */
const FlowchartEditorHost: React.FC<FlowchartEditorHostProps> = ({
  processSpecId,
  selectedNodeId,
  onNodeSelected,
}) => {
  const invoke = useKernelInvoke();
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Mount the canvas on the kernel side
  useEffect(() => {
    if (!processSpecId) return;
    let cancelled = false;

    invoke('Canvas', 'mount', { canvas: processSpecId, scope: 'process-spec' })
      .then((result) => {
        if (cancelled) return;
        if (result && (result as Record<string, unknown>).variant === 'ok') {
          setMounted(true);
        }
      })
      .catch(() => {
        // Canvas may not be seeded; render placeholder without blocking
        if (!cancelled) setMounted(true);
      });

    return () => {
      cancelled = true;
      // Canvas/unmount is fire-and-forget on cleanup
      invoke('Canvas', 'unmount', { canvas: processSpecId }).catch(() => {});
    };
  }, [processSpecId, invoke]);

  // Sync selection into the canvas
  useEffect(() => {
    if (!mounted || !selectedNodeId) return;
    invoke('Canvas', 'selectNode', { canvas: processSpecId, node: selectedNodeId }).catch(() => {});
  }, [mounted, processSpecId, selectedNodeId, invoke]);

  // Click handler — read node from data attribute and surface upward
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const nodeEl = target.closest('[data-canvas-node]') as HTMLElement | null;
    if (nodeEl) {
      const nodeId = nodeEl.dataset.canvasNode;
      if (nodeId) onNodeSelected(nodeId);
    }
  }, [onNodeSelected]);

  return (
    <div
      ref={hostRef}
      data-part="flowchart-editor-host"
      data-canvas-id={processSpecId}
      data-selected-node={selectedNodeId ?? undefined}
      role="region"
      aria-label="Graph view"
      onClick={handleClick}
      style={{
        flex: 1,
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        position: 'relative',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {mounted ? (
        <div
          data-part="canvas-viewport"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* Canvas nodes are injected here by the Canvas kernel concept
              via DOM mutation (data-canvas-node attributes). The kernel
              uses Canvas/getNodes to populate this region after mount. */}
          <div
            data-part="canvas-nodes-container"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Placeholder overlay when no nodes are present */}
          <div
            data-part="canvas-empty-hint"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: 'var(--palette-on-surface-variant)',
              fontSize: 'var(--typography-body-sm-size)',
              gap: 'var(--spacing-xs)',
            }}
          >
            <span style={{ fontSize: '24px', opacity: 0.4 }}>⬡</span>
            <span>Graph view — drag steps onto the canvas</span>
          </div>
        </div>
      ) : (
        <span style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
          Loading canvas…
        </span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// StepInspectorPane — right inspector with action-editor slot
// ---------------------------------------------------------------------------

interface StepInspectorPaneProps {
  processSpecId: string;
  stepId: string | null;
  interactionState: InteractionState;
}

type InspectorTab = 'action' | 'io-mapping' | 'error';

/**
 * StepInspectorPane — renders the flow-step-inspector widget anatomy.
 * The action-editor slot is wired inline as a form that reads step config via
 * ProcessSpec/getStep and writes via ProcessSpec/updateStep through the kernel.
 *
 * Widget spec: surface/widgets/flow-step-inspector.widget
 */
const StepInspectorPane: React.FC<StepInspectorPaneProps> = ({
  processSpecId,
  stepId,
  interactionState,
}) => {
  const invoke = useKernelInvoke();
  const [activeTab, setActiveTab] = useState<InspectorTab>('action');
  const [stepConfig, setStepConfig] = useState<Record<string, unknown>>({});
  const [stepKind, setStepKind] = useState<string>('action');
  const [loading, setLoading] = useState(false);

  const isVisible = interactionState === 'step-selected' || interactionState === 'graph-selected';

  // Load step details when stepId changes
  useEffect(() => {
    if (!stepId || !processSpecId) return;
    let cancelled = false;

    setLoading(true);
    invoke('ProcessSpec', 'getStep', { spec: processSpecId, stepId })
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result && (result as Record<string, unknown>).variant === 'ok') {
          const r = result as Record<string, unknown>;
          setStepKind(String(r.stepKind ?? 'action'));
          try {
            const cfg = r.config ? JSON.parse(String(r.config)) : {};
            setStepConfig(cfg as Record<string, unknown>);
          } catch {
            setStepConfig({});
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [stepId, processSpecId, invoke]);

  if (!isVisible || !stepId) return null;

  return (
    <div
      data-part="inspector"
      data-state={interactionState}
      data-selected-step={stepId}
      role="complementary"
      aria-label="Step inspector"
      style={{
        width: '280px',
        flexShrink: 0,
        borderLeft: '1px solid var(--palette-outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--palette-surface)',
      }}
    >
      {/* Tab strip — flow-step-inspector widget anatomy */}
      <div
        data-part="tab-list"
        role="tablist"
        aria-label="Step configuration"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--palette-outline-variant)',
          padding: '0 var(--spacing-xs)',
        }}
      >
        {(['action', 'io-mapping', 'error'] as InspectorTab[]).map((tab) => (
          <button
            key={tab}
            data-part="tab"
            role="tab"
            aria-selected={activeTab === tab ? 'true' : 'false'}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                const tabs: InspectorTab[] = ['action', 'io-mapping', 'error'];
                const next = tabs[(tabs.indexOf(activeTab) + 1) % tabs.length];
                setActiveTab(next);
              } else if (e.key === 'ArrowLeft') {
                const tabs: InspectorTab[] = ['action', 'io-mapping', 'error'];
                const prev = tabs[(tabs.indexOf(activeTab) - 1 + tabs.length) % tabs.length];
                setActiveTab(prev);
              }
            }}
            style={{
              flex: 1,
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              fontSize: '11px',
              fontWeight: activeTab === tab ? 600 : undefined,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--palette-primary)' : '2px solid transparent',
              cursor: 'pointer',
              color: activeTab === tab ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)',
            }}
          >
            {tab === 'action' ? 'Action' : tab === 'io-mapping' ? 'I/O' : 'Error'}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        data-part="tab-panel"
        role="tabpanel"
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-sm)' }}
      >
        <div data-part="active-panel">
          {loading ? (
            <p style={{ color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)' }}>
              Loading…
            </p>
          ) : (
            <>
              {/* action-editor slot — Action tab */}
              {activeTab === 'action' && (
                <div data-slot="action-editor">
                  <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Step kind
                    </div>
                    <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{stepKind}</code>
                  </div>

                  <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      Step ID
                    </div>
                    <code style={{ fontSize: 'var(--typography-code-sm-size)' }}>{stepId}</code>
                  </div>

                  {/* Action binding label / concept:action fields */}
                  <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <label
                      htmlFor={`action-binding-${stepId}`}
                      style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
                    >
                      Concept/Action
                    </label>
                    <ActionBindingPicker
                      id={`action-binding-${stepId}`}
                      processSpecId={processSpecId}
                      stepId={stepId}
                      initialValue={String(stepConfig.conceptAction ?? '')}
                      onSaved={(val) => setStepConfig(prev => ({ ...prev, conceptAction: val }))}
                    />
                  </div>

                  {/* Config JSON editor */}
                  <div>
                    <label
                      htmlFor={`config-${stepId}`}
                      style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
                    >
                      Config (JSON)
                    </label>
                    <ConfigEditor
                      id={`config-${stepId}`}
                      processSpecId={processSpecId}
                      stepId={stepId}
                      initialValue={JSON.stringify(stepConfig, null, 2)}
                      onSaved={(parsed) => setStepConfig(parsed)}
                    />
                  </div>
                </div>
              )}

              {/* data-mapping slot — I/O tab */}
              {activeTab === 'io-mapping' && (
                <div data-slot="data-mapping">
                  <p style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-sm)' }}>
                    Map input variables to step parameters and bind step outputs to downstream variables.
                  </p>
                  <DataMappingEditor
                    processSpecId={processSpecId}
                    stepId={stepId}
                    config={stepConfig}
                    onSaved={(updated) => setStepConfig(updated)}
                  />
                </div>
              )}

              {/* error-branch slot — Error tab */}
              {activeTab === 'error' && (
                <div data-slot="error-branch">
                  <p style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-sm)' }}>
                    Configure error handling: catch variants, retry policy, and fallback steps.
                  </p>
                  <ErrorBranchEditor
                    processSpecId={processSpecId}
                    stepId={stepId}
                    config={stepConfig}
                    onSaved={(updated) => setStepConfig(updated)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ActionBindingPicker — action-editor sub-widget (kernel-mediated)
//
// Replaces the former free-text ActionBindingInput with ConceptActionPicker
// (CAP-03). The stored format is unchanged: a "Concept/action" string saved
// to the `conceptAction` key inside the step config JSON.
// ---------------------------------------------------------------------------

interface ActionBindingPickerProps {
  id: string;
  processSpecId: string;
  stepId: string;
  /** Current value in "Concept/action" format, or empty string when unset. */
  initialValue: string;
  onSaved: (value: string) => void;
}

const ActionBindingPicker: React.FC<ActionBindingPickerProps> = ({
  id, processSpecId, stepId, initialValue, onSaved,
}) => {
  const invoke = useKernelInvoke();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Derive a structured picker value from the stored "Concept/action" string.
  const parseInitial = (raw: string): ConceptActionPickerValue | undefined => {
    if (!raw) return undefined;
    const sep = raw.indexOf('/');
    if (sep < 1) return undefined;
    return { concept: raw.slice(0, sep), action: raw.slice(sep + 1) };
  };

  const [pickerValue, setPickerValue] = useState<ConceptActionPickerValue | undefined>(
    parseInitial(initialValue),
  );

  // Sync picker value when the parent re-loads step config (e.g. step switch).
  useEffect(() => {
    setPickerValue(parseInitial(initialValue));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const handleChange = useCallback(
    async (val: ConceptActionPickerValue & { actionSpec?: ConceptActionSpec }) => {
      const serialized = `${val.concept}/${val.action}`;
      setPickerValue({ concept: val.concept, action: val.action });
      setSaveError(null);
      setSaving(true);
      try {
        const result = await invoke('ProcessSpec', 'updateStep', {
          spec: processSpecId,
          stepId,
          config: JSON.stringify({ conceptAction: serialized }),
        });
        if (result && (result as Record<string, unknown>).variant === 'ok') {
          onSaved(serialized);
        } else {
          setSaveError('Save failed');
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [invoke, processSpecId, stepId, onSaved],
  );

  return (
    <div data-part="action-binding-picker" id={id}>
      <ConceptActionPicker
        value={pickerValue}
        onChange={handleChange}
        filter="all"
        placeholder="Search concepts and actions…"
      />
      {saving && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', marginTop: '4px' }}
        >
          Saving…
        </p>
      )}
      {saveError && (
        <p
          role="alert"
          style={{ fontSize: '11px', color: 'var(--palette-error)', marginTop: '4px' }}
        >
          {saveError}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ConfigEditor — structured key/value config editor (kernel-mediated).
//
// Replaces the former JSON textarea. Each row is (key, typed-value) with an
// explicit type selector: string, number, boolean, or structured (JSON for
// nested objects/arrays as an escape hatch, authored through a focused
// sub-field rather than a freeform wall of JSON). Users never hand-write
// outer-level JSON; the shape is assembled row-by-row.
//
// "conceptAction" is hidden from the generic editor because it is already
// authored via ActionBindingPicker above.
// ---------------------------------------------------------------------------

type ConfigValueType = 'string' | 'number' | 'boolean' | 'structured';

interface ConfigRow {
  id: string;
  key: string;
  valueType: ConfigValueType;
  stringValue: string;
  numberValue: string;
  booleanValue: boolean;
  structuredValue: string; // serialized JSON for nested values only
}

interface ConfigEditorProps {
  id: string;
  processSpecId: string;
  stepId: string;
  initialValue: string; // serialized JSON of existing config
  onSaved: (parsed: Record<string, unknown>) => void;
}

const HIDDEN_CONFIG_KEYS = new Set([
  'conceptAction',
  'inputMapping',
  'outputMapping',
  'onError',
  'fallbackStep',
  'retry',
]);

function classifyValue(v: unknown): ConfigValueType {
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'structured';
}

function decodeRows(raw: string): ConfigRow[] {
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { /* empty */ }
  return Object.entries(parsed)
    .filter(([k]) => !HIDDEN_CONFIG_KEYS.has(k))
    .map(([k, v], i): ConfigRow => {
      const t = classifyValue(v);
      return {
        id: `row-${i}-${k}`,
        key: k,
        valueType: t,
        stringValue: t === 'string' ? String(v) : '',
        numberValue: t === 'number' ? String(v) : '',
        booleanValue: t === 'boolean' ? Boolean(v) : false,
        structuredValue: t === 'structured' ? JSON.stringify(v, null, 2) : '',
      };
    });
}

function encodeRows(
  rows: ConfigRow[],
  initialRaw: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  // Preserve hidden keys (owned by other sub-editors).
  try {
    const existing = JSON.parse(initialRaw) as Record<string, unknown>;
    for (const k of Object.keys(existing)) {
      if (HIDDEN_CONFIG_KEYS.has(k)) out[k] = existing[k];
    }
  } catch { /* ignore */ }
  for (const r of rows) {
    const key = r.key.trim();
    if (!key) continue;
    if (HIDDEN_CONFIG_KEYS.has(key)) {
      return { ok: false, error: `"${key}" is owned by another editor tab` };
    }
    switch (r.valueType) {
      case 'string':  out[key] = r.stringValue; break;
      case 'number': {
        const n = Number(r.numberValue);
        if (!Number.isFinite(n)) return { ok: false, error: `"${key}": not a number` };
        out[key] = n;
        break;
      }
      case 'boolean': out[key] = r.booleanValue; break;
      case 'structured': {
        const txt = r.structuredValue.trim();
        if (!txt) { out[key] = null; break; }
        try { out[key] = JSON.parse(txt); }
        catch { return { ok: false, error: `"${key}": invalid nested value` }; }
        break;
      }
    }
  }
  return { ok: true, value: out };
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({
  id, processSpecId, stepId, initialValue, onSaved,
}) => {
  const invoke = useKernelInvoke();
  const [rows, setRows] = useState<ConfigRow[]>(() => decodeRows(initialValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setRows(decodeRows(initialValue)); }, [initialValue]);

  const updateRow = useCallback((rowId: string, patch: Partial<ConfigRow>) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, {
      id: `row-${Date.now()}-${prev.length}`,
      key: '', valueType: 'string',
      stringValue: '', numberValue: '', booleanValue: false, structuredValue: '',
    }]);
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    const enc = encodeRows(rows, initialValue);
    if (!enc.ok) { setError(enc.error); return; }
    setSaving(true);
    try {
      const result = await invoke('ProcessSpec', 'updateStep', {
        spec: processSpecId,
        stepId,
        config: JSON.stringify(enc.value),
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        onSaved(enc.value);
      } else {
        setError('Save failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [invoke, processSpecId, stepId, rows, initialValue, onSaved]);

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 90px 1.4fr 22px',
    gap: 4,
    marginBottom: 4,
    alignItems: 'start',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: 'var(--typography-font-family)',
    fontSize: '11px',
    padding: '3px 5px',
    border: '1px solid var(--palette-outline-variant)',
    borderRadius: 'var(--radius-xs, 2px)',
    background: 'var(--palette-surface-variant)',
    color: 'var(--palette-on-surface)',
  };

  return (
    <div data-part="config-editor" id={id}>
      <div
        style={{
          ...rowStyle,
          fontSize: '10px',
          color: 'var(--palette-on-surface-variant)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 2,
        }}
      >
        <span>Key</span>
        <span>Type</span>
        <span>Value</span>
        <span />
      </div>
      {rows.length === 0 && (
        <p style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', margin: '4px 0' }}>
          No config entries. Click "Add entry" to configure this step.
        </p>
      )}
      {rows.map(r => (
        <div key={r.id} data-part="config-row" data-config-key={r.key} style={rowStyle}>
          <input
            type="text"
            data-part="config-key-input"
            value={r.key}
            onChange={e => updateRow(r.id, { key: e.target.value })}
            placeholder="key"
            aria-label={`Config key for row ${r.id}`}
            style={inputStyle}
          />
          <select
            data-part="config-type-select"
            value={r.valueType}
            onChange={e => updateRow(r.id, { valueType: e.target.value as ConfigValueType })}
            aria-label={`Type for ${r.key || 'new row'}`}
            style={inputStyle}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="structured">Structured</option>
          </select>
          {r.valueType === 'string' && (
            <input
              type="text"
              data-part="config-value-input"
              value={r.stringValue}
              onChange={e => updateRow(r.id, { stringValue: e.target.value })}
              placeholder="value"
              aria-label={`String value for ${r.key || 'row'}`}
              style={inputStyle}
            />
          )}
          {r.valueType === 'number' && (
            <input
              type="number"
              data-part="config-value-input"
              value={r.numberValue}
              onChange={e => updateRow(r.id, { numberValue: e.target.value })}
              placeholder="0"
              aria-label={`Number value for ${r.key || 'row'}`}
              style={inputStyle}
            />
          )}
          {r.valueType === 'boolean' && (
            <select
              data-part="config-value-input"
              value={r.booleanValue ? 'true' : 'false'}
              onChange={e => updateRow(r.id, { booleanValue: e.target.value === 'true' })}
              aria-label={`Boolean value for ${r.key || 'row'}`}
              style={inputStyle}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          )}
          {r.valueType === 'structured' && (
            <input
              type="text"
              data-part="config-value-input"
              value={r.structuredValue}
              onChange={e => updateRow(r.id, { structuredValue: e.target.value })}
              placeholder='e.g. ["a","b"] or {"k":1}'
              aria-label={`Structured value for ${r.key || 'row'}`}
              style={{ ...inputStyle, fontFamily: 'var(--typography-font-family-mono)' }}
            />
          )}
          <button
            type="button"
            data-part="config-row-remove"
            onClick={() => removeRow(r.id)}
            aria-label={`Remove ${r.key || 'row'}`}
            style={{
              background: 'transparent',
              border: '1px solid var(--palette-outline-variant)',
              borderRadius: 'var(--radius-xs, 2px)',
              color: 'var(--palette-on-surface-variant)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 6, alignItems: 'center' }}>
        <button
          type="button"
          data-part="config-add-row"
          onClick={addRow}
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: 'transparent',
            border: '1px dashed var(--palette-outline-variant)',
            borderRadius: 'var(--radius-xs, 2px)',
            color: 'var(--palette-on-surface)',
            cursor: 'pointer',
          }}
        >
          + Add entry
        </button>
        <button
          data-part="button"
          data-variant="filled"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && (
          <span role="alert" style={{ fontSize: '11px', color: 'var(--palette-error)' }}>{error}</span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// DataMappingEditor — I/O mapping sub-widget (kernel-mediated)
// ---------------------------------------------------------------------------

interface DataMappingEditorProps {
  processSpecId: string;
  stepId: string;
  config: Record<string, unknown>;
  onSaved: (updated: Record<string, unknown>) => void;
}

// Structured input-mapping row. Each parameter name on the current step is
// bound to a source: a literal value, the output of an upstream step, or a
// named variable previously produced in the run.
type InputSourceKind = 'literal' | 'step-output' | 'variable';

interface InputMapRow {
  id: string;
  paramKey: string;
  sourceKind: InputSourceKind;
  literalValue: string;
  stepId: string;
  stepOutputPath: string; // dot-path into the source step's output
  variableName: string;
}

interface OutputMapRow {
  id: string;
  outputPath: string; // dot-path into this step's output
  variableName: string;
}

interface UpstreamStep {
  stepId: string;
  stepLabel: string;
  stepKind: string;
  stepIndex: number;
}

function decodeInputMap(raw: unknown): InputMapRow[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  return Object.entries(obj).map(([paramKey, val], i): InputMapRow => {
    const base: InputMapRow = {
      id: `in-${i}-${paramKey}`,
      paramKey,
      sourceKind: 'literal',
      literalValue: '',
      stepId: '',
      stepOutputPath: '',
      variableName: '',
    };
    if (val && typeof val === 'object') {
      const v = val as Record<string, unknown>;
      if (typeof v.stepId === 'string') {
        return { ...base, sourceKind: 'step-output',
          stepId: v.stepId, stepOutputPath: String(v.path ?? '') };
      }
      if (typeof v.variable === 'string') {
        return { ...base, sourceKind: 'variable', variableName: v.variable };
      }
    }
    return { ...base, sourceKind: 'literal', literalValue: typeof val === 'string' ? val : JSON.stringify(val) };
  });
}

function encodeInputMap(rows: InputMapRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const k = r.paramKey.trim();
    if (!k) continue;
    if (r.sourceKind === 'literal') out[k] = r.literalValue;
    else if (r.sourceKind === 'step-output') out[k] = { stepId: r.stepId, path: r.stepOutputPath };
    else if (r.sourceKind === 'variable') out[k] = { variable: r.variableName };
  }
  return out;
}

function decodeOutputMap(raw: unknown): OutputMapRow[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, unknown>).map(([outputPath, variableName], i): OutputMapRow => ({
    id: `out-${i}-${outputPath}`,
    outputPath,
    variableName: typeof variableName === 'string' ? variableName : String(variableName),
  }));
}

function encodeOutputMap(rows: OutputMapRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    const p = r.outputPath.trim();
    const v = r.variableName.trim();
    if (p && v) out[p] = v;
  }
  return out;
}

const DataMappingEditor: React.FC<DataMappingEditorProps> = ({
  processSpecId, stepId, config, onSaved,
}) => {
  const invoke = useKernelInvoke();
  const [upstreamSteps, setUpstreamSteps] = useState<UpstreamStep[]>([]);
  const [inputRows, setInputRows] = useState<InputMapRow[]>(() => decodeInputMap(config.inputMapping));
  const [outputRows, setOutputRows] = useState<OutputMapRow[]>(() => decodeOutputMap(config.outputMapping));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputRows(decodeInputMap(config.inputMapping));
    setOutputRows(decodeOutputMap(config.outputMapping));
  }, [config]);

  // Fetch sibling steps to populate the "source step" dropdown with
  // only steps that precede this one.
  useEffect(() => {
    if (!processSpecId) return;
    let cancelled = false;
    invoke('ProcessSpec', 'getSteps', { spec: processSpecId })
      .then((result) => {
        if (cancelled) return;
        if (result && (result as Record<string, unknown>).variant === 'ok') {
          const r = result as Record<string, unknown>;
          let raw: unknown[] = [];
          try {
            raw = Array.isArray(r.steps) ? (r.steps as unknown[])
              : JSON.parse(String(r.steps ?? '[]')) as unknown[];
          } catch { raw = []; }
          const selfStep = (raw as Array<Record<string, unknown>>).find(s => s.stepId === stepId);
          const selfIndex = typeof selfStep?.stepIndex === 'number' ? selfStep.stepIndex : Number.POSITIVE_INFINITY;
          const upstream = (raw as Array<Record<string, unknown>>)
            .filter(s => typeof s.stepIndex === 'number' && (s.stepIndex as number) < selfIndex)
            .map((s): UpstreamStep => ({
              stepId: String(s.stepId ?? ''),
              stepLabel: String(s.stepLabel ?? s.stepId ?? ''),
              stepKind: String(s.stepKind ?? 'action'),
              stepIndex: Number(s.stepIndex ?? 0),
            }));
          setUpstreamSteps(upstream);
        }
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [processSpecId, stepId, invoke]);

  const updateInput = (rowId: string, patch: Partial<InputMapRow>) =>
    setInputRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
  const removeInput = (rowId: string) =>
    setInputRows(prev => prev.filter(r => r.id !== rowId));
  const addInput = () =>
    setInputRows(prev => [...prev, {
      id: `in-${Date.now()}-${prev.length}`,
      paramKey: '', sourceKind: 'step-output',
      literalValue: '', stepId: '', stepOutputPath: '', variableName: '',
    }]);

  const updateOutput = (rowId: string, patch: Partial<OutputMapRow>) =>
    setOutputRows(prev => prev.map(r => r.id === rowId ? { ...r, ...patch } : r));
  const removeOutput = (rowId: string) =>
    setOutputRows(prev => prev.filter(r => r.id !== rowId));
  const addOutput = () =>
    setOutputRows(prev => [...prev, {
      id: `out-${Date.now()}-${prev.length}`,
      outputPath: '', variableName: '',
    }]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const updated = {
        ...config,
        inputMapping: encodeInputMap(inputRows),
        outputMapping: encodeOutputMap(outputRows),
      };
      const result = await invoke('ProcessSpec', 'updateStep', {
        spec: processSpecId,
        stepId,
        config: JSON.stringify(updated),
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        onSaved(updated as Record<string, unknown>);
      } else {
        setError('Save failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [invoke, processSpecId, stepId, config, inputRows, outputRows, onSaved]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: 'var(--typography-font-family)',
    fontSize: '11px',
    padding: '3px 5px',
    border: '1px solid var(--palette-outline-variant)',
    borderRadius: 'var(--radius-xs, 2px)',
    background: 'var(--palette-surface-variant)',
    color: 'var(--palette-on-surface)',
  };
  const removeBtn = (onClick: () => void, label: string): React.ReactElement => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'transparent',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-xs, 2px)',
        color: 'var(--palette-on-surface-variant)',
        cursor: 'pointer',
        fontSize: '11px',
        padding: 0,
      }}
    >×</button>
  );

  return (
    <div data-part="data-mapping-editor">
      {/* Input mapping — typed rows */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Input mapping
        </div>
        {inputRows.length === 0 && (
          <p style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', margin: '4px 0' }}>
            No input bindings. Parameters default to this step&apos;s static config.
          </p>
        )}
        {inputRows.map(r => (
          <div
            key={r.id}
            data-part="input-mapping-row"
            data-param-key={r.paramKey}
            data-source-kind={r.sourceKind}
            style={{ display: 'grid', gridTemplateColumns: '1fr 110px 1.4fr 22px', gap: 4, marginBottom: 4, alignItems: 'center' }}
          >
            <input
              type="text"
              data-part="input-mapping-param"
              value={r.paramKey}
              onChange={e => updateInput(r.id, { paramKey: e.target.value })}
              placeholder="parameter"
              aria-label="Parameter name"
              style={inputStyle}
            />
            <select
              data-part="input-mapping-source-kind"
              value={r.sourceKind}
              onChange={e => updateInput(r.id, { sourceKind: e.target.value as InputSourceKind })}
              aria-label="Source kind"
              style={inputStyle}
            >
              <option value="step-output">Step output</option>
              <option value="variable">Variable</option>
              <option value="literal">Literal</option>
            </select>
            {r.sourceKind === 'literal' && (
              <input
                type="text"
                data-part="input-mapping-literal"
                value={r.literalValue}
                onChange={e => updateInput(r.id, { literalValue: e.target.value })}
                placeholder="value"
                aria-label="Literal value"
                style={inputStyle}
              />
            )}
            {r.sourceKind === 'variable' && (
              <input
                type="text"
                data-part="input-mapping-variable"
                value={r.variableName}
                onChange={e => updateInput(r.id, { variableName: e.target.value })}
                placeholder="variableName"
                aria-label="Variable name"
                style={{ ...inputStyle, fontFamily: 'var(--typography-font-family-mono)' }}
              />
            )}
            {r.sourceKind === 'step-output' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <select
                  data-part="input-mapping-step"
                  value={r.stepId}
                  onChange={e => updateInput(r.id, { stepId: e.target.value })}
                  aria-label="Source step"
                  style={inputStyle}
                >
                  <option value="">— select step —</option>
                  {upstreamSteps.map(s => (
                    <option key={s.stepId} value={s.stepId}>
                      {`#${s.stepIndex + 1} ${s.stepLabel} (${s.stepKind})`}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  data-part="input-mapping-step-path"
                  value={r.stepOutputPath}
                  onChange={e => updateInput(r.id, { stepOutputPath: e.target.value })}
                  placeholder="output.field"
                  aria-label="Output path on source step"
                  style={{ ...inputStyle, fontFamily: 'var(--typography-font-family-mono)' }}
                />
              </div>
            )}
            {removeBtn(() => removeInput(r.id), `Remove binding for ${r.paramKey || 'row'}`)}
          </div>
        ))}
        <button
          type="button"
          data-part="input-mapping-add"
          onClick={addInput}
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: 'transparent',
            border: '1px dashed var(--palette-outline-variant)',
            borderRadius: 'var(--radius-xs, 2px)',
            color: 'var(--palette-on-surface)',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >+ Add input binding</button>
      </div>

      {/* Output mapping — typed rows */}
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Output bindings
        </div>
        {outputRows.length === 0 && (
          <p style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', margin: '4px 0' }}>
            No output bindings. Step results won&apos;t be exposed as named variables.
          </p>
        )}
        {outputRows.map(r => (
          <div
            key={r.id}
            data-part="output-mapping-row"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 22px', gap: 4, marginBottom: 4, alignItems: 'center' }}
          >
            <input
              type="text"
              data-part="output-mapping-path"
              value={r.outputPath}
              onChange={e => updateOutput(r.id, { outputPath: e.target.value })}
              placeholder="output.field"
              aria-label="Output path"
              style={{ ...inputStyle, fontFamily: 'var(--typography-font-family-mono)' }}
            />
            <input
              type="text"
              data-part="output-mapping-variable"
              value={r.variableName}
              onChange={e => updateOutput(r.id, { variableName: e.target.value })}
              placeholder="variableName"
              aria-label="Variable name"
              style={{ ...inputStyle, fontFamily: 'var(--typography-font-family-mono)' }}
            />
            {removeBtn(() => removeOutput(r.id), `Remove output ${r.outputPath || 'row'}`)}
          </div>
        ))}
        <button
          type="button"
          data-part="output-mapping-add"
          onClick={addOutput}
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: 'transparent',
            border: '1px dashed var(--palette-outline-variant)',
            borderRadius: 'var(--radius-xs, 2px)',
            color: 'var(--palette-on-surface)',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >+ Add output binding</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
        <button
          data-part="button"
          data-variant="filled"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save mapping'}
        </button>
        {error && (
          <span role="alert" style={{ fontSize: '11px', color: 'var(--palette-error)' }}>{error}</span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ErrorBranchEditor — error-branch sub-widget (kernel-mediated)
// ---------------------------------------------------------------------------

interface ErrorBranchEditorProps {
  processSpecId: string;
  stepId: string;
  config: Record<string, unknown>;
  onSaved: (updated: Record<string, unknown>) => void;
}

const ErrorBranchEditor: React.FC<ErrorBranchEditorProps> = ({
  processSpecId, stepId, config, onSaved,
}) => {
  const invoke = useKernelInvoke();
  const [onError, setOnError] = useState<string>(String(config.onError ?? 'fail'));
  const [fallbackStep, setFallbackStep] = useState<string>(String(config.fallbackStep ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOnError(String(config.onError ?? 'fail'));
    setFallbackStep(String(config.fallbackStep ?? ''));
  }, [config]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const updated = { ...config, onError, fallbackStep };
      const result = await invoke('ProcessSpec', 'updateStep', {
        spec: processSpecId,
        stepId,
        config: JSON.stringify(updated),
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        onSaved(updated);
      } else {
        setError('Save failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [invoke, processSpecId, stepId, config, onError, fallbackStep, onSaved]);

  return (
    <div data-part="error-branch-editor">
      <div style={{ marginBottom: 'var(--spacing-sm)' }}>
        <label style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', marginBottom: 2 }}>
          On error
        </label>
        <select
          value={onError}
          onChange={(e) => setOnError(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            border: '1px solid var(--palette-outline-variant)',
            borderRadius: 'var(--radius-xs, 2px)',
            background: 'var(--palette-surface-variant)',
            color: 'var(--palette-on-surface)',
            fontSize: 'var(--typography-body-sm-size)',
          }}
        >
          <option value="fail">Fail the run</option>
          <option value="continue">Continue to next step</option>
          <option value="retry">Retry (use Retry tab)</option>
          <option value="goto">Go to fallback step</option>
        </select>
      </div>
      {onError === 'goto' && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', marginBottom: 2 }}>
            Fallback step ID
          </label>
          <input
            type="text"
            value={fallbackStep}
            onChange={(e) => setFallbackStep(e.target.value)}
            placeholder="e.g. handle-error"
            style={{
              width: '100%',
              fontFamily: 'var(--typography-font-family-mono)',
              fontSize: 'var(--typography-code-sm-size)',
              padding: '4px 6px',
              border: '1px solid var(--palette-outline-variant)',
              borderRadius: 'var(--radius-xs, 2px)',
              background: 'var(--palette-surface-variant)',
              color: 'var(--palette-on-surface)',
            }}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
        <button
          data-part="button"
          data-variant="filled"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && (
          <span role="alert" style={{ fontSize: '11px', color: 'var(--palette-error)' }}>{error}</span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FlowBuilder — main component
// ---------------------------------------------------------------------------

export const FlowBuilder: React.FC<FlowBuilderProps> = ({
  processSpecId,
  initialView = 'steps',
  onStepSelected,
  mode = 'edit',
  context,
}) => {
  const invoke = useKernelInvoke();
  const isCreate = mode === 'create';

  // ---- FSM state ----
  const [interactionState, setInteractionState] = useState<InteractionState>('idle');
  const [viewState, setViewState] = useState<ViewState>(initialView);

  // ---- Data state (kernel-sourced) ----
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  // In create mode: start with a single "start" trigger node and no edges
  const [steps, setSteps] = useState<StepRecord[]>(
    isCreate
      ? [{ stepId: 'start', stepKind: 'trigger', stepLabel: 'Start', stepIndex: 0, isCollapsible: false, isCollapsed: false }]
      : [],
  );
  const [collapsedBranches, setCollapsedBranches] = useState<string[]>([]);
  const [dragPayload, setDragPayload] = useState<{ nodeType: string } | null>(null);

  // ---- Load steps from kernel (skipped in create mode — starts with single "start" node) ----
  useEffect(() => {
    if (isCreate || !processSpecId) return;
    let cancelled = false;

    invoke('ProcessSpec', 'getSteps', { spec: processSpecId })
      .then((result) => {
        if (cancelled) return;
        if (result && (result as Record<string, unknown>).variant === 'ok') {
          const r = result as Record<string, unknown>;
          try {
            const raw = Array.isArray(r.steps)
              ? (r.steps as unknown[])
              : JSON.parse(String(r.steps ?? '[]')) as unknown[];
            setSteps(raw as StepRecord[]);
          } catch {
            setSteps([]);
          }
        }
      })
      .catch(() => { /* non-fatal — steps stay empty */ });

    return () => { cancelled = true; };
  }, [processSpecId, invoke, isCreate]);

  // ---- FSM transitions ----

  const handleSelectStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    setInteractionState('step-selected');
    onStepSelected?.(stepId);
  }, [onStepSelected]);

  const handleSelectGraphNode = useCallback((nodeId: string) => {
    setSelectedStepId(nodeId);
    setInteractionState('graph-selected');
    onStepSelected?.(nodeId);
  }, [onStepSelected]);

  const handleEscape = useCallback(() => {
    setInteractionState('idle');
    setSelectedStepId(null);
    onStepSelected?.(null);
  }, [onStepSelected]);

  const handleToggleView = useCallback(() => {
    setViewState(prev => prev === 'steps' ? 'graph' : 'steps');
  }, []);

  const handleToggleCollapse = useCallback((stepId: string) => {
    setCollapsedBranches(prev =>
      prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId],
    );
  }, []);

  // ---- Drag from palette ----

  const handlePaletteDragStart = useCallback((nodeType: string) => {
    if (!processSpecId) return;
    setDragPayload({ nodeType });
    setInteractionState('dragging-from-palette');
  }, [processSpecId]);

  const handleDropOnSteps = useCallback(async (index: number) => {
    if (!dragPayload || !processSpecId) return;

    try {
      const result = await invoke('ProcessSpec', 'addStep', {
        spec: processSpecId,
        stepKind: dragPayload.nodeType,
        atIndex: index,
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        const r = result as Record<string, unknown>;
        const newStepId = String(r.stepId ?? '');
        // Refresh steps
        const stepsResult = await invoke('ProcessSpec', 'getSteps', { spec: processSpecId });
        if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
          const sr = stepsResult as Record<string, unknown>;
          try {
            const raw = Array.isArray(sr.steps)
              ? (sr.steps as unknown[])
              : JSON.parse(String(sr.steps ?? '[]')) as unknown[];
            setSteps(raw as StepRecord[]);
          } catch { /* ignore */ }
        }
        if (newStepId) {
          setSelectedStepId(newStepId);
          setInteractionState('step-selected');
        }
      }
    } catch { /* non-fatal */ }

    setDragPayload(null);
    setInteractionState(selectedStepId ? 'step-selected' : 'idle');
  }, [invoke, processSpecId, dragPayload, selectedStepId]);

  const handleDragCancel = useCallback(() => {
    setDragPayload(null);
    setInteractionState(selectedStepId ? 'step-selected' : 'idle');
  }, [selectedStepId]);

  // ---- Insert at index ----
  const handleInsertAt = useCallback(async (index: number) => {
    if (!processSpecId) return;
    try {
      const result = await invoke('ProcessSpec', 'addStep', {
        spec: processSpecId,
        stepKind: 'action',
        atIndex: index,
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        const r = result as Record<string, unknown>;
        const newStepId = String(r.stepId ?? '');
        const stepsResult = await invoke('ProcessSpec', 'getSteps', { spec: processSpecId });
        if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
          const sr = stepsResult as Record<string, unknown>;
          try {
            const raw = Array.isArray(sr.steps)
              ? (sr.steps as unknown[])
              : JSON.parse(String(sr.steps ?? '[]')) as unknown[];
            setSteps(raw as StepRecord[]);
          } catch { /* ignore */ }
        }
        if (newStepId) {
          setSelectedStepId(newStepId);
          setInteractionState('step-selected');
        }
      }
    } catch { /* non-fatal */ }
  }, [invoke, processSpecId]);

  // ---- Reorder ----
  const handleReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!processSpecId) return;
    try {
      await invoke('ProcessSpec', 'moveStep', {
        spec: processSpecId,
        fromIndex,
        toIndex,
      });
      const stepsResult = await invoke('ProcessSpec', 'getSteps', { spec: processSpecId });
      if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
        const sr = stepsResult as Record<string, unknown>;
        try {
          const raw = Array.isArray(sr.steps)
            ? (sr.steps as unknown[])
            : JSON.parse(String(sr.steps ?? '[]')) as unknown[];
          setSteps(raw as StepRecord[]);
        } catch { /* ignore */ }
      }
    } catch { /* non-fatal */ }
  }, [invoke, processSpecId]);

  // ---- Keyboard handler on root ----
  const handleRootKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleEscape();
  }, [handleEscape]);

  // ---- Drop zone handlers ----
  const handleCenterPaneDragOver = useCallback((e: React.DragEvent) => {
    if (interactionState === 'dragging-from-palette') {
      e.preventDefault();
    }
  }, [interactionState]);

  const handleCenterPaneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (viewState === 'steps') {
      // Drop at end of steps list
      handleDropOnSteps(steps.length);
    } else {
      // In graph mode, let the canvas handle spatial drop
      handleDropOnSteps(steps.length);
    }
  }, [viewState, steps.length, handleDropOnSteps]);

  return (
    <div
      data-part="root"
      data-state={interactionState}
      data-view={viewState}
      data-process-spec-id={processSpecId}
      data-selected-step={selectedStepId ?? undefined}
      role="application"
      aria-label="Flow Builder"
      onKeyDown={handleRootKeyDown}
      tabIndex={-1}
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        minHeight: 0,
        background: 'var(--palette-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--palette-outline-variant)',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Left palette — anatomy part: palette                                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="palette"
        data-state={interactionState}
        role="list"
        aria-label="Node type palette"
        aria-description="Drag items onto the canvas to add steps to the flow"
        style={{
          width: '160px',
          flexShrink: 0,
          borderRight: '1px solid var(--palette-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          padding: 'var(--spacing-sm)',
          overflowY: 'auto',
        }}
      >
        <div style={{
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--palette-on-surface-variant)',
          marginBottom: 'var(--spacing-xs)',
          paddingLeft: '4px',
        }}>
          Node types
        </div>

        {PALETTE_ENTRIES.map((entry) => (
          <div
            key={entry.nodeType}
            data-part="palette-item"
            data-node-type={entry.nodeType}
            data-grabbed={
              interactionState === 'dragging-from-palette' && dragPayload?.nodeType === entry.nodeType
                ? 'true'
                : 'false'
            }
            role="listitem"
            aria-label={`${entry.label} node`}
            aria-roledescription="draggable node type"
            aria-grabbed={
              interactionState === 'dragging-from-palette' && dragPayload?.nodeType === entry.nodeType
                ? 'true'
                : 'false'
            }
            draggable={processSpecId !== '' ? true : false}
            tabIndex={0}
            onPointerDown={() => {
              if (processSpecId) handlePaletteDragStart(entry.nodeType);
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && processSpecId) {
                e.preventDefault();
                handlePaletteDragStart(entry.nodeType);
              }
            }}
            onDragEnd={handleDragCancel}
            title={entry.description}
            style={{
              padding: '6px var(--spacing-sm)',
              borderRadius: 'var(--radius-sm)',
              cursor: processSpecId ? 'grab' : 'not-allowed',
              border: '1px solid var(--palette-outline-variant)',
              background: 'var(--palette-surface-variant)',
              fontSize: 'var(--typography-body-sm-size)',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              opacity: processSpecId ? 1 : 0.5,
              outline: 'none',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '12px' }}>{entry.label}</span>
            <span style={{
              fontSize: '10px',
              color: 'var(--palette-on-surface-variant)',
              lineHeight: 1.3,
            }}>
              {entry.description}
            </span>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Center pane — anatomy part: centerPane + viewToggle                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Toolbar with view toggle + Save/Publish/Cancel actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          borderBottom: '1px solid var(--palette-outline-variant)',
          background: 'var(--palette-surface)',
          flexShrink: 0,
        }}>
          {isCreate && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--palette-on-surface)', marginRight: 'var(--spacing-xs)' }}>
              Create Flow
            </span>
          )}
          {/* View toggle — anatomy part: viewToggle */}
          <button
            data-part="view-toggle"
            data-view={viewState}
            onClick={handleToggleView}
            aria-label={viewState === 'graph' ? 'Switch to Steps view' : 'Switch to Graph view'}
            aria-pressed={viewState === 'graph' ? 'true' : 'false'}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--palette-outline-variant)',
              background: 'var(--palette-surface-variant)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                opacity: viewState === 'steps' ? 1 : 0.4,
                fontWeight: viewState === 'steps' ? 600 : undefined,
              }}
            >
              Steps
            </span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span
              style={{
                opacity: viewState === 'graph' ? 1 : 0.4,
                fontWeight: viewState === 'graph' ? 600 : undefined,
              }}
            >
              Graph
            </span>
          </button>

          <div style={{ flex: 1 }} />

          {/* Save / Publish / Cancel — ActionBinding-mediated */}
          {isCreate ? (
            <ActionButton
              binding="process-spec-create"
              context={{ spec: processSpecId, steps }}
              label="Create Flow"
              buttonVariant="primary"
              onSuccess={() => {/* created */}}
            />
          ) : (
            <>
              <ActionButton
                binding="process-spec-save"
                context={{ spec: processSpecId }}
                label="Save"
                buttonVariant="default"
                onSuccess={() => {/* saved */}}
              />
              <ActionButton
                binding="process-spec-publish"
                context={{ spec: processSpecId }}
                label="Publish"
                buttonVariant="primary"
                onSuccess={() => {/* published */}}
              />
            </>
          )}
          <ActionButton
            binding="process-spec-cancel"
            context={{ spec: processSpecId }}
            label="Cancel"
            buttonVariant="ghost"
            onSuccess={() => handleEscape()}
          />
        </div>

        {/* Center view — anatomy part: centerPane */}
        <div
          data-part="center-pane"
          data-view={viewState}
          role="region"
          aria-label={viewState === 'graph' ? 'Graph view' : 'Steps view'}
          aria-live="polite"
          onDragOver={handleCenterPaneDragOver}
          onDrop={handleCenterPaneDrop}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Steps view — rendered by StepsView (flow-steps-view widget) */}
          {viewState === 'steps' && (
            <StepsView
              processSpecId={processSpecId}
              selectedStepId={selectedStepId}
              collapsedBranches={collapsedBranches}
              steps={steps}
              onSelect={handleSelectStep}
              onInsertAt={handleInsertAt}
              onToggleCollapse={handleToggleCollapse}
              onReorder={handleReorder}
            />
          )}

          {/* Graph view — FlowchartEditor canvas host */}
          {viewState === 'graph' && (
            <FlowchartEditorHost
              processSpecId={processSpecId}
              selectedNodeId={selectedStepId}
              onNodeSelected={handleSelectGraphNode}
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right inspector — anatomy part: inspector                           */}
      {/* ------------------------------------------------------------------ */}
      <StepInspectorPane
        processSpecId={processSpecId}
        stepId={selectedStepId}
        interactionState={interactionState}
      />
    </div>
  );
};

export default FlowBuilder;
