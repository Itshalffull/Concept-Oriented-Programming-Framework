'use client';

// ============================================================
// Clef Surface Next.js Widget — ScoreTracePanel
//
// Displays a Score flow trace showing the full causal chain:
// action -> sync -> completion. Each step in the trace shows
// timing, status, and the concept/action involved. Supports
// expanding individual steps for detail and filtering by status.
// Used in the Score analysis layer for debugging sync chains.
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export type TraceStepType = 'action' | 'sync' | 'completion';
export type TraceStepStatus = 'success' | 'failure' | 'pending' | 'skipped';

export interface TraceStep {
  id: string;
  type: TraceStepType;
  label: string;
  concept?: string;
  action?: string;
  syncName?: string;
  status: TraceStepStatus;
  durationMs?: number;
  timestamp?: string;
  detail?: string;
  children?: TraceStep[];
}

// --------------- Props ---------------

export interface ScoreTracePanelProps {
  /** Trace steps to display. */
  steps?: TraceStep[];
  /** Title for the panel. */
  title?: string;
  /** Currently selected step ID. */
  selectedStepId?: string | null;
  /** Filter to show only steps matching this status. */
  statusFilter?: TraceStepStatus | 'all';
  /** Callback when a step is selected. */
  onSelectStep?: (stepId: string) => void;
  /** Callback when the selection is cleared. */
  onClearSelection?: () => void;
  /** Callback when the status filter changes. */
  onFilterChange?: (status: TraceStepStatus | 'all') => void;
}

// --------------- State Machine ---------------

type PanelState = 'overview' | 'stepSelected';

// --------------- Component ---------------

export const ScoreTracePanel: React.FC<ScoreTracePanelProps> = ({
  steps = [],
  title = 'Flow Trace',
  selectedStepId: selectedStepIdProp = null,
  statusFilter: statusFilterProp = 'all',
  onSelectStep,
  onClearSelection,
  onFilterChange,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(selectedStepIdProp);
  const [panelState, setPanelState] = useState<PanelState>(
    selectedStepIdProp ? 'stepSelected' : 'overview',
  );
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<TraceStepStatus | 'all'>(statusFilterProp);

  // Sync props
  React.useEffect(() => {
    setSelectedStepId(selectedStepIdProp);
    setPanelState(selectedStepIdProp ? 'stepSelected' : 'overview');
  }, [selectedStepIdProp]);

  React.useEffect(() => {
    setStatusFilter(statusFilterProp);
  }, [statusFilterProp]);

  const handleSelectStep = useCallback(
    (stepId: string) => {
      setSelectedStepId(stepId);
      setPanelState('stepSelected');
      onSelectStep?.(stepId);
    },
    [onSelectStep],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedStepId(null);
    setPanelState('overview');
    onClearSelection?.();
  }, [onClearSelection]);

  const handleToggleExpand = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const handleFilterChange = useCallback(
    (filter: TraceStepStatus | 'all') => {
      setStatusFilter(filter);
      onFilterChange?.(filter);
    },
    [onFilterChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && panelState === 'stepSelected') {
        handleClearSelection();
      }
    },
    [panelState, handleClearSelection],
  );

  // Filter steps
  const filteredSteps =
    statusFilter === 'all'
      ? steps
      : steps.filter((s) => s.status === statusFilter);

  // Find selected step
  const findStep = (stepsToSearch: TraceStep[], id: string): TraceStep | undefined => {
    for (const step of stepsToSearch) {
      if (step.id === id) return step;
      if (step.children) {
        const found = findStep(step.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const selectedStep = selectedStepId ? findStep(steps, selectedStepId) : undefined;

  // Render a trace step recursively
  const renderStep = (step: TraceStep, depth: number = 0) => {
    const isExpanded = expandedSteps.has(step.id);
    const isSelected = step.id === selectedStepId;
    const hasChildren = step.children && step.children.length > 0;

    return (
      <div
        key={step.id}
        data-step-id={step.id}
        data-step-type={step.type}
        data-status={step.status}
        data-selected={isSelected ? 'true' : 'false'}
        data-depth={depth}
        data-part="step"
        role="treeitem"
        aria-expanded={hasChildren ? (isExpanded ? 'true' : 'false') : undefined}
        aria-selected={isSelected ? 'true' : 'false'}
        aria-label={`${step.type}: ${step.label} (${step.status})`}
      >
        {/* Step header */}
        <div
          data-part="step-header"
          onClick={() => handleSelectStep(step.id)}
          tabIndex={0}
        >
          {/* Expand toggle for steps with children */}
          {hasChildren && (
            <button
              data-part="step-expand"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand(step.id);
              }}
              type="button"
            />
          )}

          {/* Step type badge */}
          <span data-part="step-type-badge" data-type={step.type}>
            {step.type}
          </span>

          {/* Step label */}
          <span data-part="step-label">{step.label}</span>

          {/* Concept/action info */}
          {step.concept && (
            <span data-part="step-concept">{step.concept}</span>
          )}
          {step.action && (
            <span data-part="step-action">{step.action}</span>
          )}
          {step.syncName && (
            <span data-part="step-sync">{step.syncName}</span>
          )}

          {/* Status indicator */}
          <span data-part="step-status" data-status={step.status}>
            {step.status}
          </span>

          {/* Duration */}
          {step.durationMs !== undefined && (
            <span data-part="step-duration">
              {step.durationMs}ms
            </span>
          )}

          {/* Timestamp */}
          {step.timestamp && (
            <span data-part="step-timestamp">{step.timestamp}</span>
          )}
        </div>

        {/* Step detail (shown when selected) */}
        {isSelected && step.detail && (
          <div data-part="step-detail" aria-live="polite">
            {step.detail}
          </div>
        )}

        {/* Children (shown when expanded) */}
        {hasChildren && isExpanded && (
          <div role="group" data-part="step-children">
            {step.children!.map((child) => renderStep(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="region"
      aria-label={title}
      data-state={panelState}
      data-filter={statusFilter}
      data-part="root"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div data-part="header">
        <span data-part="title">{title}</span>
        <span data-part="step-count">{filteredSteps.length} steps</span>
        {panelState === 'stepSelected' && (
          <button
            data-part="clear-selection"
            aria-label="Clear selection"
            onClick={handleClearSelection}
            type="button"
          />
        )}
      </div>

      {/* Filter bar */}
      <div role="toolbar" aria-label="Filter by status" data-part="filter-bar">
        {(['all', 'success', 'failure', 'pending', 'skipped'] as const).map(
          (filter) => (
            <button
              key={filter}
              data-part="filter-button"
              data-filter={filter}
              data-active={statusFilter === filter ? 'true' : 'false'}
              aria-pressed={statusFilter === filter ? 'true' : 'false'}
              onClick={() => handleFilterChange(filter)}
              type="button"
            >
              {filter}
            </button>
          ),
        )}
      </div>

      {/* Selected step detail */}
      {selectedStep && (
        <div data-part="selected-detail" aria-live="polite">
          <span data-part="selected-label">{selectedStep.label}</span>
          <span data-part="selected-type">{selectedStep.type}</span>
          <span data-part="selected-status">{selectedStep.status}</span>
          {selectedStep.durationMs !== undefined && (
            <span data-part="selected-duration">{selectedStep.durationMs}ms</span>
          )}
        </div>
      )}

      {/* Trace tree */}
      <div role="tree" aria-label="Trace steps" data-part="trace-tree">
        {filteredSteps.map((step) => renderStep(step))}
      </div>
    </div>
  );
};

ScoreTracePanel.displayName = 'ScoreTracePanel';
export default ScoreTracePanel;
