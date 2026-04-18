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

import React, { useCallback, useEffect, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
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
  nodeType: 'trigger' | 'action' | 'branch' | 'catch' | 'logic' | 'manual' | 'vote' | 'brainstorm' | 'contest' | 'consent-agenda' | 'content-creation';
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

/** An edge between two steps, fetched from ProcessSpec/getEdges */
interface EdgeRecord {
  edgeId: string;
  fromStepId: string;
  toStepId: string;
  label: string; // "default" | "true" | "false" | "error" | custom
}

export interface FlowBuilderProps {
  processSpecId?: string;
  /** Controlled: initial view mode */
  initialView?: ViewState;
  /** Controlled: caller can observe selection changes */
  onStepSelected?: (stepId: string | null) => void;
  mode?: 'create' | 'edit';
  context?: { processSpecId?: string; steps?: StepRecord[] } | null;
  onSave?: () => void | Promise<void>;
  onPublish?: () => void | Promise<void>;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Palette entries — static node type catalogue
// ---------------------------------------------------------------------------

const PALETTE_ENTRIES: PaletteEntry[] = [
  { nodeType: 'trigger',  label: 'Trigger',  description: 'Entry point that starts the flow' },
  { nodeType: 'action',   label: 'Action',   description: 'Invoke a concept action' },
  { nodeType: 'manual',   label: 'Manual',   description: 'Human task — pauses for manual completion' },
  { nodeType: 'branch',   label: 'Branch',   description: 'Conditional fork in the flow' },
  { nodeType: 'catch',    label: 'Catch',    description: 'Error handler for upstream steps' },
  { nodeType: 'logic',    label: 'Logic',    description: 'Data transformation or mapping step' },
  { nodeType: 'vote',           label: 'Vote',           description: 'Structured vote — participants cast Yes/No/Abstain' },
  { nodeType: 'brainstorm',     label: 'Brainstorm',     description: 'Open idea collection with endorsement and shortlisting' },
  { nodeType: 'contest',        label: 'Contest',        description: 'Proposal contest — participants submit and sponsor proposals' },
  { nodeType: 'consent-agenda', label: 'Consent Agenda', description: 'Sociocratic consent round through objection and integration' },
  { nodeType: 'content-creation', label: 'Content Creation', description: 'Participant creates a content node of a specified schema' },
];

// ---------------------------------------------------------------------------
// StepsView — inline linear list for the Steps pane
// ---------------------------------------------------------------------------

interface StepsViewProps {
  processSpecId: string;
  selectedStepId: string | null;
  collapsedBranches: string[];
  steps: StepRecord[];
  edges: EdgeRecord[];
  onSelect: (stepId: string) => void;
  onInsertAt: (index: number, kindOverride?: string) => void;
  onToggleCollapse: (stepId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddBranchStep: (fromStepId: string, edgeLabel: string) => void;
}

const StepsView: React.FC<StepsViewProps> = ({
  processSpecId,
  selectedStepId,
  collapsedBranches,
  steps,
  edges,
  onSelect,
  onInsertAt,
  onToggleCollapse,
  onAddBranchStep,
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

  // Build a set of step IDs that are arms of a branch (connected via true/false edges).
  // These are rendered inline under their parent branch instead of in the main list.
  const armStepIds = new Set<string>();
  for (const edge of edges) {
    if (edge.label === 'true' || edge.label === 'false') {
      armStepIds.add(edge.toStepId);
    }
  }

  // Main-line steps: top-level (no parentId) and not a branch arm
  const mainLineSteps = steps.filter(s => !s.parentId && !armStepIds.has(s.stepId));

  // Get steps connected to a given step via a specific edge label
  const getArmSteps = (branchStepId: string, label: 'true' | 'false'): StepRecord[] => {
    const connected = edges
      .filter(e => e.fromStepId === branchStepId && e.label === label)
      .map(e => steps.find(s => s.stepId === e.toStepId))
      .filter(Boolean) as StepRecord[];
    return connected;
  };

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
            style={{ width: '100%', height: '12px', background: 'none', border: 'none', cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 10 }}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === '+' || e.key === 'Enter') onInsertAt(0); }}
          />
        </li>

        {mainLineSteps.map((step, idx) => {
          const isSelected = step.stepId === selectedStepId;
          const isCollapsed = collapsedBranches.includes(step.stepId);
          const isBranch = step.stepKind === 'branch';
          const trueArmSteps = isBranch ? getArmSteps(step.stepId, 'true') : [];
          const falseArmSteps = isBranch ? getArmSteps(step.stepId, 'false') : [];

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
                aria-expanded={isBranch ? (!isCollapsed ? 'true' : 'false') : undefined}
                tabIndex={0}
                onClick={() => onSelect(step.stepId)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(step.stepId); }}
                style={{
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isSelected ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
                  background: isSelected ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: '6px var(--spacing-sm)' }}>
                  <span draggable aria-roledescription="drag handle" role="button" tabIndex={0}
                    style={{ cursor: 'grab', opacity: 0.5, fontSize: '10px', userSelect: 'none' }}>⠿</span>
                  <span style={{
                    fontSize: '10px', padding: '1px 5px', borderRadius: 'var(--radius-xs, 2px)',
                    background: STEP_KIND_COLOR[step.stepKind] ? `${STEP_KIND_COLOR[step.stepKind]}22` : 'var(--palette-secondary-container)',
                    color: STEP_KIND_COLOR[step.stepKind] ?? 'var(--palette-on-secondary-container)',
                    fontFamily: 'var(--typography-font-family-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {STEP_KIND_ICON[step.stepKind] ?? ''} {step.stepKind}
                  </span>
                  <span style={{ flex: 1, fontSize: 'var(--typography-body-sm-size)', fontWeight: isSelected ? 600 : undefined }}>
                    {step.stepLabel}
                  </span>
                  {isBranch && (
                    <button
                      data-part="collapse-toggle"
                      aria-label={isCollapsed ? 'Expand branch arms' : 'Collapse branch arms'}
                      aria-expanded={isCollapsed ? 'false' : 'true'}
                      onClick={(e) => { e.stopPropagation(); onToggleCollapse(step.stepId); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--palette-on-surface-variant)' }}
                    >
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                  )}
                </div>
              </li>

              {/* Branch arms — rendered inline below the branch step */}
              {isBranch && !isCollapsed && (
                <li style={{ listStyle: 'none' }}>
                  <div
                    data-part="branch-arms"
                    data-step-id={step.stepId}
                    style={{ display: 'flex', gap: 6, marginLeft: 12, marginTop: 2, marginBottom: 2 }}
                  >
                    {/* True arm */}
                    <div
                      data-part="branch-arm"
                      data-arm="true"
                      style={{
                        flex: 1, borderLeft: '2px solid #4caf50', paddingLeft: 8,
                        background: 'var(--palette-surface-variant)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        padding: '6px 8px',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 600 }}>
                        ✓ True path
                      </div>
                      {trueArmSteps.map((child) => (
                        <div
                          key={child.stepId}
                          data-part="arm-step-item"
                          data-step-id={child.stepId}
                          role="button"
                          tabIndex={0}
                          aria-current={child.stepId === selectedStepId ? 'true' : 'false'}
                          aria-label={`${child.stepKind} step: ${child.stepLabel}`}
                          onClick={(e) => { e.stopPropagation(); onSelect(child.stepId); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onSelect(child.stepId); } }}
                          style={{
                            borderRadius: 'var(--radius-sm)', border: `1px solid ${child.stepId === selectedStepId ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
                            background: child.stepId === selectedStepId ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                            padding: '4px 8px', cursor: 'pointer', fontSize: 'var(--typography-body-sm-size)',
                            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                          }}
                        >
                          <span style={{ fontSize: '10px', color: STEP_KIND_COLOR[child.stepKind] ?? 'var(--palette-on-surface-variant)' }}>{STEP_KIND_ICON[child.stepKind]}</span>
                          <span>{child.stepLabel}</span>
                        </div>
                      ))}
                      <button
                        data-part="add-branch-step"
                        data-arm="true"
                        onClick={(e) => { e.stopPropagation(); onAddBranchStep(step.stepId, 'true'); }}
                        style={{
                          width: '100%', marginTop: 2, padding: '3px 8px', background: 'none',
                          border: '1px dashed #4caf5088', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
                          fontSize: '11px', color: '#4caf50', textAlign: 'left',
                        }}
                      >
                        ⊕ Add True step
                      </button>
                    </div>

                    {/* False arm */}
                    <div
                      data-part="branch-arm"
                      data-arm="false"
                      style={{
                        flex: 1, borderLeft: '2px solid var(--palette-error)', paddingLeft: 8,
                        background: 'var(--palette-surface-variant)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        padding: '6px 8px',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: 'var(--palette-error)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 600 }}>
                        ✗ False path
                      </div>
                      {falseArmSteps.map((child) => (
                        <div
                          key={child.stepId}
                          data-part="arm-step-item"
                          data-step-id={child.stepId}
                          role="button"
                          tabIndex={0}
                          aria-current={child.stepId === selectedStepId ? 'true' : 'false'}
                          aria-label={`${child.stepKind} step: ${child.stepLabel}`}
                          onClick={(e) => { e.stopPropagation(); onSelect(child.stepId); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onSelect(child.stepId); } }}
                          style={{
                            borderRadius: 'var(--radius-sm)', border: `1px solid ${child.stepId === selectedStepId ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
                            background: child.stepId === selectedStepId ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
                            padding: '4px 8px', cursor: 'pointer', fontSize: 'var(--typography-body-sm-size)',
                            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                          }}
                        >
                          <span style={{ fontSize: '10px', color: STEP_KIND_COLOR[child.stepKind] ?? 'var(--palette-on-surface-variant)' }}>{STEP_KIND_ICON[child.stepKind]}</span>
                          <span>{child.stepLabel}</span>
                        </div>
                      ))}
                      <button
                        data-part="add-branch-step"
                        data-arm="false"
                        onClick={(e) => { e.stopPropagation(); onAddBranchStep(step.stepId, 'false'); }}
                        style={{
                          width: '100%', marginTop: 2, padding: '3px 8px', background: 'none',
                          border: '1px dashed var(--palette-error-container, #f4433644)', borderRadius: 'var(--radius-xs)', cursor: 'pointer',
                          fontSize: '11px', color: 'var(--palette-error)', textAlign: 'left',
                        }}
                      >
                        ⊕ Add False step
                      </button>
                    </div>
                  </div>
                </li>
              )}

              {/* Insert handle after this step */}
              <li>
                <button
                  data-part="insert-handle"
                  data-index={idx + 1}
                  onClick={() => onInsertAt(idx + 1)}
                  aria-label={`Insert step after position ${idx + 1}`}
                  style={{ width: '100%', height: '12px', background: 'none', border: 'none', cursor: 'pointer', outline: 'none', position: 'relative', zIndex: 10 }}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === '+' || e.key === 'Enter') onInsertAt(idx + 1); }}
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

const STEP_KIND_ICON: Record<string, string> = {
  trigger: '▶',
  action:  '⚡',
  manual:  '👤',
  branch:  '◇',
  catch:   '⚠',
  logic:   'λ',
  vote:             'V',
  brainstorm:       'B',
  contest:          'C',
  'consent-agenda': 'CA',
  'content-creation': 'CC',
};

const STEP_KIND_COLOR: Record<string, string> = {
  trigger: 'var(--palette-primary)',
  action:  'var(--palette-secondary)',
  manual:  '#2e7d32',
  branch:  '#c07000',
  catch:   'var(--palette-error)',
  logic:   '#5c6ac4',
  vote:              'var(--palette-secondary)',
  brainstorm:        'var(--palette-tertiary)',
  contest:           'var(--palette-error)',
  'consent-agenda':  'var(--palette-primary)',
  'content-creation': 'var(--palette-secondary)',
};

interface FlowchartEditorHostProps {
  processSpecId: string;
  steps: StepRecord[];
  edges: EdgeRecord[];
  selectedNodeId: string | null;
  onNodeSelected: (nodeId: string) => void;
}

const FlowchartEditorHost: React.FC<FlowchartEditorHostProps> = ({
  processSpecId,
  steps,
  edges,
  selectedNodeId,
  onNodeSelected,
}) => {
  // Steps that are arm children of a branch — shown inline under the branch node
  const armStepIds = new Set<string>();
  for (const edge of edges) {
    if (edge.label === 'true' || edge.label === 'false') armStepIds.add(edge.toStepId);
  }

  const sorted = [...steps]
    .filter(s => !armStepIds.has(s.stepId))
    .sort((a, b) => a.stepIndex - b.stepIndex);

  const getOutgoing = (stepId: string) => edges.filter(e => e.fromStepId === stepId);
  const stepById = (id: string) => steps.find(s => s.stepId === id);

  const renderNode = (step: StepRecord, compact = false) => {
    const isSelected = step.stepId === selectedNodeId;
    const kindColor = STEP_KIND_COLOR[step.stepKind] ?? 'var(--palette-on-surface-variant)';
    const icon = STEP_KIND_ICON[step.stepKind] ?? '●';
    return (
      <button
        key={step.stepId}
        data-canvas-node={step.stepId}
        onClick={() => onNodeSelected(step.stepId)}
        aria-label={`${step.stepKind} step: ${step.stepLabel}`}
        aria-pressed={isSelected ? 'true' : 'false'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          padding: compact ? '5px 10px' : '8px 12px',
          borderRadius: 'var(--radius-sm)',
          border: isSelected ? `2px solid ${kindColor}` : '2px solid var(--palette-outline-variant)',
          background: 'var(--palette-surface)',
          boxShadow: isSelected ? `0 0 0 3px ${kindColor}33` : undefined,
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--palette-on-surface)',
        }}
      >
        <span style={{ fontSize: compact ? '11px' : '13px', color: kindColor, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: '10px', color: kindColor, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, minWidth: compact ? 36 : 44 }}>
          {step.stepKind}
        </span>
        <span style={{ fontSize: 'var(--typography-body-sm-size)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {step.stepLabel}
        </span>
      </button>
    );
  };

  return (
    <div
      data-part="flowchart-editor-host"
      data-canvas-id={processSpecId}
      data-selected-node={selectedNodeId ?? undefined}
      role="region"
      aria-label="Graph view"
      style={{
        flex: 1,
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--spacing-md)',
        gap: 0,
      }}
    >
      {sorted.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--palette-on-surface-variant)', fontSize: 'var(--typography-body-sm-size)', gap: 'var(--spacing-xs)' }}>
          <span style={{ fontSize: '24px', opacity: 0.4 }}>◇</span>
          <span>Add steps in the Steps view to build the flow</span>
        </div>
      ) : (
        sorted.map((step, idx) => {
          const outgoing = getOutgoing(step.stepId);
          const trueEdge = outgoing.find(e => e.label === 'true');
          const falseEdge = outgoing.find(e => e.label === 'false');
          const isBranch = step.stepKind === 'branch' && (trueEdge || falseEdge);
          const trueTarget = trueEdge ? stepById(trueEdge.toStepId) : undefined;
          const falseTarget = falseEdge ? stepById(falseEdge.toStepId) : undefined;

          return (
            <div key={step.stepId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '480px' }}>
              {idx > 0 && (
                <div style={{ width: 2, height: 16, background: 'var(--palette-outline-variant)', flexShrink: 0 }} />
              )}

              {/* Step node */}
              {renderNode(step)}

              {/* Branch fork: two arms side by side */}
              {isBranch && (
                <div style={{ display: 'flex', width: '100%', gap: 6, marginTop: 0 }}>
                  {/* True arm */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 2, height: 12, background: '#4caf50', flexShrink: 0 }} />
                    <div style={{ fontSize: '10px', color: '#4caf50', fontWeight: 600, marginBottom: 4 }}>✓ True</div>
                    {trueTarget ? renderNode(trueTarget, true) : (
                      <div style={{ width: '100%', padding: '4px 8px', background: '#4caf5011', border: '1px dashed #4caf5066', borderRadius: 'var(--radius-xs)', fontSize: '11px', color: '#4caf50', textAlign: 'center' }}>
                        empty
                      </div>
                    )}
                  </div>
                  {/* Divider */}
                  <div style={{ width: 1, background: 'var(--palette-outline-variant)', flexShrink: 0, alignSelf: 'stretch' }} />
                  {/* False arm */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 2, height: 12, background: 'var(--palette-error, #f44336)', flexShrink: 0 }} />
                    <div style={{ fontSize: '10px', color: 'var(--palette-error, #f44336)', fontWeight: 600, marginBottom: 4 }}>✗ False</div>
                    {falseTarget ? renderNode(falseTarget, true) : (
                      <div style={{ width: '100%', padding: '4px 8px', background: '#f4433611', border: '1px dashed #f4433666', borderRadius: 'var(--radius-xs)', fontSize: '11px', color: 'var(--palette-error, #f44336)', textAlign: 'center' }}>
                        empty
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// StepKindInspector — Action tab content differentiated by step kind
// ---------------------------------------------------------------------------

interface StepKindInspectorProps {
  stepId: string;
  stepKind: string;
  stepConfig: Record<string, unknown>;
  processSpecId: string;
  onConfigChange: (updated: Record<string, unknown>) => void;
}

const SimpleConfigField: React.FC<{
  label: string;
  fieldKey: string;
  placeholder?: string;
  multiline?: boolean;
  value: string;
  onChange: (key: string, val: string) => void;
}> = ({ label, fieldKey, placeholder, multiline, value, onChange }) => (
  <div style={{ marginBottom: 'var(--spacing-sm)' }}>
    <label
      style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}
    >
      {label}
    </label>
    {multiline ? (
      <textarea
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        style={{ width: '100%', fontSize: 'var(--typography-body-sm-size)', resize: 'vertical', padding: '4px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--palette-outline-variant)', background: 'var(--palette-surface-container)', color: 'var(--palette-on-surface)', fontFamily: 'var(--typography-code-family)', boxSizing: 'border-box' }}
      />
    ) : (
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        style={{ width: '100%', fontSize: 'var(--typography-body-sm-size)', padding: '4px 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--palette-outline-variant)', background: 'var(--palette-surface-container)', color: 'var(--palette-on-surface)', boxSizing: 'border-box' }}
      />
    )}
  </div>
);

const StepKindInspector: React.FC<StepKindInspectorProps> = ({
  stepId, stepKind, stepConfig, processSpecId, onConfigChange,
}) => {
  const invoke = useKernelInvoke();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(stepConfig);

  useEffect(() => { setLocalConfig(stepConfig); }, [stepConfig]);

  const handleFieldChange = useCallback((key: string, val: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = useCallback(async (config: Record<string, unknown>) => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await invoke('ProcessSpec', 'updateStep', {
        spec: processSpecId,
        stepId,
        config: JSON.stringify(config),
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        onConfigChange(config);
      } else {
        setSaveError('Save failed');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [invoke, processSpecId, stepId, onConfigChange]);

  const str = (key: string) => String(localConfig[key] ?? '');

  const kindLabel: Record<string, string> = { trigger: 'Trigger', action: 'Action', branch: 'Branch', catch: 'Catch', logic: 'Logic', vote: 'Vote', brainstorm: 'Brainstorm', contest: 'Contest', 'consent-agenda': 'Consent Agenda' };

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '10px', background: 'var(--palette-surface-variant)', color: STEP_KIND_COLOR[stepKind] ?? 'var(--palette-on-surface-variant)', padding: '2px 6px', borderRadius: 'var(--radius-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {kindLabel[stepKind] ?? stepKind}
        </span>
        <code style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stepId}</code>
      </div>

      {stepKind === 'trigger' && (
        <>
          <SimpleConfigField label="Event name" fieldKey="eventName" placeholder="e.g. form.submitted" value={str('eventName')} onChange={handleFieldChange} />
          <SimpleConfigField label="Condition" fieldKey="condition" placeholder="Optional filter expression" multiline value={str('condition')} onChange={handleFieldChange} />
        </>
      )}

      {stepKind === 'action' && (
        <>
          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Concept / Action
            </label>
            <ConceptActionPicker
              value={str('conceptAction') ? (() => {
                const sep = str('conceptAction').indexOf('/');
                return sep > 0 ? { concept: str('conceptAction').slice(0, sep), action: str('conceptAction').slice(sep + 1) } : undefined;
              })() : undefined}
              onChange={(val) => handleFieldChange('conceptAction', `${val.concept}/${val.action}`)}
              filter="all"
              placeholder="Search concepts and actions…"
            />
            <p style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', marginTop: 4, marginBottom: 0 }}>
              Input parameters are configured in the I/O tab.
            </p>
          </div>
        </>
      )}

      {stepKind === 'branch' && (
        <>
          <SimpleConfigField label="Condition expression" fieldKey="condition" placeholder="e.g. input.status == 'approved'" multiline value={str('condition')} onChange={handleFieldChange} />
          <SimpleConfigField label="True branch label" fieldKey="trueLabel" placeholder="Yes" value={str('trueLabel')} onChange={handleFieldChange} />
          <SimpleConfigField label="False branch label" fieldKey="falseLabel" placeholder="No" value={str('falseLabel')} onChange={handleFieldChange} />
        </>
      )}

      {stepKind === 'catch' && (
        <>
          <SimpleConfigField label="Error variant to catch" fieldKey="catchVariant" placeholder="e.g. not_found (leave empty to catch all)" value={str('catchVariant')} onChange={handleFieldChange} />
          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Recovery action
            </label>
            <ConceptActionPicker
              value={str('recoveryAction') ? (() => {
                const sep = str('recoveryAction').indexOf('/');
                return sep > 0 ? { concept: str('recoveryAction').slice(0, sep), action: str('recoveryAction').slice(sep + 1) } : undefined;
              })() : undefined}
              onChange={(val) => handleFieldChange('recoveryAction', `${val.concept}/${val.action}`)}
              filter="all"
              placeholder="Search concepts and actions…"
            />
          </div>
        </>
      )}

      {stepKind === 'logic' && (
        <>
          <SimpleConfigField label="Transform expression" fieldKey="expression" placeholder="e.g. { result: input.items.filter(x => x.active) }" multiline value={str('expression')} onChange={handleFieldChange} />
          <SimpleConfigField label="Output variable name" fieldKey="outputVar" placeholder="e.g. filteredItems" value={str('outputVar')} onChange={handleFieldChange} />
        </>
      )}

      {stepKind === 'vote' && (
        <>
          <SimpleConfigField label="Vote session ID" fieldKey="voteSessionId" placeholder="e.g. vote-session-xyz" value={str('voteSessionId')} onChange={handleFieldChange} />
          <SimpleConfigField label="Voting method" fieldKey="votingMethod" placeholder="simple-majority | supermajority | unanimous" value={str('votingMethod')} onChange={handleFieldChange} />
          <SimpleConfigField label="Quorum (%)" fieldKey="quorum" placeholder="e.g. 50" value={str('quorum')} onChange={handleFieldChange} />
          <SimpleConfigField label="Deadline (ISO 8601)" fieldKey="deadline" placeholder="e.g. 2026-06-01T17:00:00Z" value={str('deadline')} onChange={handleFieldChange} />
          <SimpleConfigField label="Allow change vote?" fieldKey="allowChange" placeholder="true | false" value={str('allowChange')} onChange={handleFieldChange} />
          <SimpleConfigField label="Anonymous?" fieldKey="anonymous" placeholder="true | false" value={str('anonymous')} onChange={handleFieldChange} />
        </>
      )}

      {stepKind === 'brainstorm' && (
        <>
          <SimpleConfigField label="Board ID" fieldKey="boardId" placeholder="e.g. board-xyz (auto-created if blank)" value={str('boardId')} onChange={handleFieldChange} />
          <SimpleConfigField label="Shortlist size" fieldKey="shortlistSize" placeholder="e.g. 5" value={str('shortlistSize')} onChange={handleFieldChange} />
          <SimpleConfigField label="Anonymous submissions?" fieldKey="anonymous" placeholder="true | false" value={str('anonymous')} onChange={handleFieldChange} />
        </>
      )}

      {stepKind === 'contest' && (
        <>
          <SimpleConfigField label="Brainstorm step key (for preseeded proposals)" fieldKey="brainstormStepKey" placeholder="e.g. brainstorm-1 (leave blank to start fresh)" value={str('brainstormStepKey')} onChange={handleFieldChange} />
          <p style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm)' }}>
            If a brainstorm step key is provided, its shortlisted ideas will be pre-seeded as proposals.
          </p>
        </>
      )}

      {stepKind === 'consent-agenda' && (
        <>
          <SimpleConfigField label="Consent process ID" fieldKey="consentProcessId" placeholder="e.g. consent-process-xyz" value={str('consentProcessId')} onChange={handleFieldChange} />
          <p style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', margin: '0 0 var(--spacing-sm)' }}>
            Guides participants through presenting, clarifying, reacting, objection, and decision phases.
          </p>
        </>
      )}

      {stepKind === 'content-creation' && (
        <>
          <SimpleConfigField label="Schema ID" fieldKey="schemaId" placeholder="e.g. meeting-notes" value={str('schemaId')} onChange={handleFieldChange} />
          <SimpleConfigField label="Content type label" fieldKey="contentTypeName" placeholder="e.g. Meeting Notes" value={str('contentTypeName')} onChange={handleFieldChange} />
          <SimpleConfigField label="Required fields (comma-separated)" fieldKey="requiredFields" placeholder="e.g. title,date,attendees" value={str('requiredFields')} onChange={handleFieldChange} />
        </>
      )}

      <button
        onClick={() => handleSave(localConfig)}
        disabled={saving}
        style={{ marginTop: 'var(--spacing-xs)', padding: '4px 12px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--palette-primary)', color: 'var(--palette-on-primary)', fontSize: '12px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {saveError && (
        <p role="alert" style={{ fontSize: '11px', color: 'var(--palette-error)', marginTop: 4 }}>{saveError}</p>
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
  onClose?: () => void;
  onLabelChange?: (stepId: string, newLabel: string) => void;
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
  onClose,
  onLabelChange,
}) => {
  const invoke = useKernelInvoke();
  const [activeTab, setActiveTab] = useState<InspectorTab>('action');
  const [stepConfig, setStepConfig] = useState<Record<string, unknown>>({});
  const [stepKind, setStepKind] = useState<string>('action');
  const [stepLabel, setStepLabel] = useState<string>('');
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
          setStepLabel(String(r.stepLabel ?? ''));
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

  const handleLabelBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!stepId || !processSpecId) return;
    const trimmed = e.target.value.trim();
    if (!trimmed) return;
    setStepLabel(trimmed);
    invoke('ProcessSpec', 'updateStep', { spec: processSpecId, stepId, stepLabel: trimmed }).catch(() => {});
    onLabelChange?.(stepId, trimmed);
  };

  const handleKindChange = (newKind: string) => {
    if (!stepId || !processSpecId) return;
    setStepKind(newKind);
    invoke('ProcessSpec', 'updateStep', { spec: processSpecId, stepId, stepKind: newKind }).catch(() => {});
  };

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
      {/* Step label + kind editor */}
      <div style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', borderBottom: '1px solid var(--palette-outline-variant)' }}>
        <input
          data-part="step-label-input"
          aria-label="Step label"
          value={stepLabel}
          onChange={(e) => setStepLabel(e.target.value)}
          onBlur={handleLabelBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="Step label"
          style={{
            width: '100%',
            fontSize: '13px',
            fontWeight: 600,
            padding: '4px 6px',
            border: '1px solid transparent',
            borderRadius: '4px',
            background: 'transparent',
            color: 'var(--palette-on-surface)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--palette-primary)'; (e.target as HTMLInputElement).style.background = 'var(--palette-surface-variant, #f5f5f5)'; }}
          onBlurCapture={(e) => { (e.target as HTMLInputElement).style.borderColor = 'transparent'; (e.target as HTMLInputElement).style.background = 'transparent'; }}
        />
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '10px', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            Kind
          </label>
          <select
            data-part="step-kind-select"
            aria-label="Step kind"
            value={stepKind}
            onChange={(e) => handleKindChange(e.target.value)}
            style={{
              flex: 1,
              fontSize: '12px',
              padding: '2px 4px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--palette-outline-variant)',
              background: 'var(--palette-surface-container)',
              color: STEP_KIND_COLOR[stepKind] ?? 'var(--palette-on-surface)',
              cursor: 'pointer',
            }}
          >
            <option value="trigger">▶ Trigger</option>
            <option value="action">⚡ Action</option>
            <option value="manual">👤 Manual</option>
            <option value="branch">◇ Branch</option>
            <option value="catch">⚠ Catch</option>
            <option value="logic">λ Logic</option>
            <option value="vote">⬆ Vote</option>
            <option value="brainstorm">💡 Brainstorm</option>
            <option value="contest">🏆 Contest</option>
            <option value="consent-agenda">✅ Consent Agenda</option>
            <option value="content-creation">Content Creation</option>
          </select>
        </div>
      </div>

      {/* Tab strip — flow-step-inspector widget anatomy */}
      <div
        data-part="tab-list"
        role="tablist"
        aria-label="Step configuration"
        style={{
          display: 'flex',
          alignItems: 'center',
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
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close inspector"
            title="Close"
            style={{
              marginLeft: 'auto',
              padding: '2px 6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--palette-on-surface-variant)',
              fontSize: '14px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
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
              {/* action-editor slot — Action tab, content varies by stepKind */}
              {activeTab === 'action' && (
                <div data-slot="action-editor">
                  <StepKindInspector
                    stepId={stepId}
                    stepKind={stepKind}
                    stepConfig={stepConfig}
                    processSpecId={processSpecId}
                    onConfigChange={(updated) => setStepConfig(updated)}
                  />
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
  processSpecId: processSpecIdProp,
  initialView = 'steps',
  onStepSelected,
  mode = 'edit',
  context,
  onSave,
  onPublish,
  onCancel: onCancelProp,
}) => {
  const invoke = useKernelInvoke();
  const isCreate = mode === 'create';
  const processSpecId = processSpecIdProp ?? '';

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
  const [edges, setEdges] = useState<EdgeRecord[]>([]);
  const [collapsedBranches, setCollapsedBranches] = useState<string[]>([]);
  const [dragPayload, setDragPayload] = useState<{ nodeType: string } | null>(null);
  const [selectedPaletteNodeType, setSelectedPaletteNodeType] = useState<string>('action');
  const [savedToast, setSavedToast] = useState(false);

  // ---- Shared helper: refresh steps + edges from kernel ----
  const refreshGraph = useCallback(async () => {
    const [stepsResult, edgesResult] = await Promise.all([
      invoke('ProcessSpec', 'getSteps', { spec: processSpecId }),
      invoke('ProcessSpec', 'getEdges', { spec: processSpecId }),
    ]);
    if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
      const r = stepsResult as Record<string, unknown>;
      try {
        const raw = Array.isArray(r.steps)
          ? (r.steps as unknown[])
          : JSON.parse(String(r.steps ?? '[]')) as unknown[];
        setSteps(raw as StepRecord[]);
      } catch { setSteps([]); }
    }
    if (edgesResult && (edgesResult as Record<string, unknown>).variant === 'ok') {
      const r = edgesResult as Record<string, unknown>;
      const raw = Array.isArray(r.edges) ? (r.edges as EdgeRecord[]) : [];
      setEdges(raw);
    }
  }, [invoke, processSpecId]);

  // ---- Load steps + edges from kernel (skipped in create mode) ----
  useEffect(() => {
    if (isCreate || !processSpecId) return;
    let cancelled = false;

    Promise.all([
      invoke('ProcessSpec', 'getSteps', { spec: processSpecId }),
      invoke('ProcessSpec', 'getEdges', { spec: processSpecId }),
    ]).then(([stepsResult, edgesResult]) => {
      if (cancelled) return;
      if (stepsResult && (stepsResult as Record<string, unknown>).variant === 'ok') {
        const r = stepsResult as Record<string, unknown>;
        try {
          const raw = Array.isArray(r.steps)
            ? (r.steps as unknown[])
            : JSON.parse(String(r.steps ?? '[]')) as unknown[];
          setSteps(raw as StepRecord[]);
        } catch { setSteps([]); }
      }
      if (edgesResult && (edgesResult as Record<string, unknown>).variant === 'ok') {
        const r = edgesResult as Record<string, unknown>;
        const raw = Array.isArray(r.edges) ? (r.edges as EdgeRecord[]) : [];
        setEdges(raw);
      }
    }).catch(() => { /* non-fatal */ });

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
    setSelectedPaletteNodeType(nodeType);
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
        const newStepId = String((result as Record<string, unknown>).stepId ?? '');
        await refreshGraph();
        if (newStepId) {
          setSelectedStepId(newStepId);
          setInteractionState('step-selected');
        }
      }
    } catch { /* non-fatal */ }
    setDragPayload(null);
    setInteractionState(selectedStepId ? 'step-selected' : 'idle');
  }, [invoke, processSpecId, dragPayload, selectedStepId, refreshGraph]);

  const handleDragCancel = useCallback(() => {
    setDragPayload(null);
    setInteractionState(selectedStepId ? 'step-selected' : 'idle');
  }, [selectedStepId]);

  // ---- Insert at index (main line) ----
  const handleInsertAt = useCallback(async (index: number, kindOverride?: string) => {
    if (!processSpecId) return;
    try {
      const result = await invoke('ProcessSpec', 'addStep', {
        spec: processSpecId,
        stepKind: kindOverride ?? selectedPaletteNodeType,
        atIndex: index,
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        const newStepId = String((result as Record<string, unknown>).stepId ?? '');
        await refreshGraph();
        if (newStepId) {
          setSelectedStepId(newStepId);
          setInteractionState('step-selected');
        }
      }
    } catch { /* non-fatal */ }
  }, [invoke, processSpecId, refreshGraph]);

  // ---- Add step to a branch arm (true/false path) ----
  const handleAddBranchStep = useCallback(async (fromStepId: string, edgeLabel: string) => {
    if (!processSpecId) return;
    try {
      const result = await invoke('ProcessSpec', 'addStep', {
        spec: processSpecId,
        stepKind: 'action',
        fromStepId,
        edgeLabel,
      });
      if (result && (result as Record<string, unknown>).variant === 'ok') {
        const newStepId = String((result as Record<string, unknown>).stepId ?? '');
        await refreshGraph();
        if (newStepId) {
          setSelectedStepId(newStepId);
          setInteractionState('step-selected');
        }
      }
    } catch { /* non-fatal */ }
  }, [invoke, processSpecId, refreshGraph]);

  // ---- Reorder ----
  const handleReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!processSpecId) return;
    try {
      await invoke('ProcessSpec', 'moveStep', { spec: processSpecId, fromIndex, toIndex });
      await refreshGraph();
    } catch { /* non-fatal */ }
  }, [invoke, processSpecId, refreshGraph]);

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
            onClick={() => {
              if (!processSpecId) return;
              setSelectedPaletteNodeType(entry.nodeType);
              void handleInsertAt(steps.length, entry.nodeType);
            }}
            onPointerDown={() => {
              if (processSpecId) handlePaletteDragStart(entry.nodeType);
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && processSpecId) {
                e.preventDefault();
                setSelectedPaletteNodeType(entry.nodeType);
                void handleInsertAt(steps.length, entry.nodeType);
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
              color: 'var(--palette-on-surface-variant)',
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

          {/* Save / Publish / Cancel */}
          {isCreate ? (
            <button data-part="button" data-variant="filled" onClick={() => void onSave?.()}>
              Create Flow
            </button>
          ) : (
            <>
              {onSave && (
                <button
                  data-part="button"
                  data-variant="outlined"
                  onClick={async () => {
                    await onSave();
                    setSavedToast(true);
                    setTimeout(() => setSavedToast(false), 2000);
                  }}
                >
                  Save
                </button>
              )}
              {savedToast && (
                <span
                  role="status"
                  aria-live="polite"
                  style={{
                    fontSize: '11px',
                    color: 'var(--palette-primary)',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--palette-primary-container)',
                    animation: 'fadeIn 0.15s ease',
                  }}
                >
                  ✓ Saved
                </span>
              )}
              {onPublish && (
                <button data-part="button" data-variant="filled" onClick={() => void onPublish()}>
                  Publish
                </button>
              )}
            </>
          )}
          <button data-part="button" data-variant="ghost" onClick={() => { onCancelProp?.(); handleEscape(); }}>
            Cancel
          </button>
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
              edges={edges}
              onSelect={handleSelectStep}
              onInsertAt={handleInsertAt}
              onToggleCollapse={handleToggleCollapse}
              onReorder={handleReorder}
              onAddBranchStep={handleAddBranchStep}
            />
          )}

          {/* Graph view — FlowchartEditor canvas host */}
          {viewState === 'graph' && (
            <FlowchartEditorHost
              processSpecId={processSpecId}
              steps={steps}
              edges={edges}
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
        onClose={handleEscape}
        onLabelChange={(sid, newLabel) =>
          setSteps((prev) => prev.map((s) => s.stepId === sid ? { ...s, stepLabel: newLabel } : s))
        }
      />
    </div>
  );
};

export default FlowBuilder;
