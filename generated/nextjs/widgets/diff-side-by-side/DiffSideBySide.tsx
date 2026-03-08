'use client';

// ============================================================
// Clef Surface Next.js Widget — DiffSideBySide
//
// Two or three column side-by-side diff view for field-level
// comparisons on wide viewports. Shows source and target versions
// in parallel columns with optional ancestor column for three-way
// merge conflicts. Interactive mode adds per-field resolution controls.
// Serves the diff-view interactor type (Section 5.10.3).
// ============================================================

import React, { useState, useCallback } from 'react';

// --------------- Types ---------------

export interface FieldComparison {
  fieldName: string;
  sourceValue?: string;
  targetValue?: string;
  ancestorValue?: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

export type ResolutionChoice = 'unresolved' | 'resolvedLeft' | 'resolvedRight' | 'resolvedBoth';

// --------------- Props ---------------

export interface DiffSideBySideProps {
  /** Source version record. */
  source?: Record<string, unknown>;
  /** Target version record. */
  target?: Record<string, unknown>;
  /** Ancestor version record for three-way diffs. */
  ancestor?: Record<string, unknown>;
  /** Number of diff ways: 2 or 3. */
  wayCount?: 2 | 3;
  /** Diff granularity. */
  granularity?: string;
  /** Whether interactive resolution mode is enabled. */
  interactive?: boolean;
  /** Label for the source column. */
  sourceLabel?: string;
  /** Label for the target column. */
  targetLabel?: string;
  /** Label for the ancestor column. */
  ancestorLabel?: string;
  /** Number of additions. */
  additions?: number;
  /** Number of deletions. */
  deletions?: number;
  /** Number of conflicts. */
  conflicts?: number;
  /** Pre-computed field comparisons. */
  fields?: FieldComparison[];
  /** Callback when a field is resolved. */
  onResolve?: (fieldName: string, choice: ResolutionChoice) => void;
}

// --------------- State Machine ---------------

type NavigationState = 'idle' | 'atField';

// --------------- Component ---------------

export const DiffSideBySide: React.FC<DiffSideBySideProps> = ({
  source = {},
  target = {},
  ancestor,
  wayCount = 2,
  granularity = 'field',
  interactive = false,
  sourceLabel = 'Source',
  targetLabel = 'Target',
  ancestorLabel = 'Ancestor',
  additions = 0,
  deletions = 0,
  conflicts = 0,
  fields = [],
  onResolve,
}) => {
  const [navigationState, setNavigationState] = useState<NavigationState>('idle');
  const [activeFieldIndex, setActiveFieldIndex] = useState<number>(-1);
  const [resolutions, setResolutions] = useState<Record<string, ResolutionChoice>>({});

  const handleNavigate = useCallback(
    (index: number) => {
      setActiveFieldIndex(index);
      setNavigationState('atField');
    },
    [],
  );

  const handlePrevChange = useCallback(() => {
    const changedIndices = fields
      .map((f, i) => (f.changeType !== 'unchanged' ? i : -1))
      .filter((i) => i >= 0);
    const currentPos = changedIndices.findIndex((i) => i >= activeFieldIndex);
    const prevIdx = currentPos > 0 ? changedIndices[currentPos - 1] : changedIndices[changedIndices.length - 1];
    if (prevIdx !== undefined) handleNavigate(prevIdx);
  }, [fields, activeFieldIndex, handleNavigate]);

  const handleNextChange = useCallback(() => {
    const changedIndices = fields
      .map((f, i) => (f.changeType !== 'unchanged' ? i : -1))
      .filter((i) => i >= 0);
    const currentPos = changedIndices.findIndex((i) => i > activeFieldIndex);
    const nextIdx = currentPos >= 0 ? changedIndices[currentPos] : changedIndices[0];
    if (nextIdx !== undefined) handleNavigate(nextIdx);
  }, [fields, activeFieldIndex, handleNavigate]);

  const handleUseLeft = useCallback(
    (fieldName: string) => {
      setResolutions((prev) => ({ ...prev, [fieldName]: 'resolvedLeft' }));
      onResolve?.(fieldName, 'resolvedLeft');
    },
    [onResolve],
  );

  const handleUseRight = useCallback(
    (fieldName: string) => {
      setResolutions((prev) => ({ ...prev, [fieldName]: 'resolvedRight' }));
      onResolve?.(fieldName, 'resolvedRight');
    },
    [onResolve],
  );

  const handleUseBoth = useCallback(
    (fieldName: string) => {
      setResolutions((prev) => ({ ...prev, [fieldName]: 'resolvedBoth' }));
      onResolve?.(fieldName, 'resolvedBoth');
    },
    [onResolve],
  );

  const statsText = `+${additions} -${deletions}${conflicts > 0 ? ` !${conflicts}` : ''}`;

  return (
    <div
      role="region"
      aria-label="Side-by-side diff view"
      data-way-count={wayCount}
      data-interactive={interactive ? 'true' : 'false'}
      data-part="root"
    >
      {/* Toolbar */}
      <div data-part="toolbar">
        <span data-part="change-stats">{statsText}</span>
        <button
          data-part="prev-button"
          aria-label="Previous change"
          onClick={handlePrevChange}
          type="button"
        />
        <button
          data-part="next-button"
          aria-label="Next change"
          onClick={handleNextChange}
          type="button"
        />
      </div>

      {/* Columns */}
      <div data-part="columns">
        {/* Source column */}
        <div role="region" aria-label="Source version" data-part="source-column">
          <div data-part="source-header">{sourceLabel}</div>
          {fields.map((field, index) => {
            const isChanged = field.changeType !== 'unchanged';
            return (
              <div
                key={`source-${field.fieldName}`}
                data-field={field.fieldName}
                data-change-type={field.changeType}
                data-part={isChanged ? 'changed-field' : 'matched-field'}
                aria-label={isChanged ? `Changed field: ${field.fieldName}` : undefined}
                onClick={() => handleNavigate(index)}
              >
                <span data-part="field-label">{field.fieldName}</span>
                <span data-part="field-value">{field.sourceValue ?? ''}</span>
              </div>
            );
          })}
        </div>

        {/* Ancestor column (three-way only) */}
        <div
          role="region"
          aria-label="Common ancestor"
          data-part="ancestor-column"
          hidden={wayCount === 2}
        >
          <div data-part="ancestor-header">{ancestorLabel}</div>
          {fields.map((field) => (
            <div key={`ancestor-${field.fieldName}`} data-field={field.fieldName} data-part="matched-field">
              <span data-part="field-label">{field.fieldName}</span>
              <span data-part="field-value">{field.ancestorValue ?? ''}</span>
            </div>
          ))}
        </div>

        {/* Target column */}
        <div role="region" aria-label="Target version" data-part="target-column">
          <div data-part="target-header">{targetLabel}</div>
          {fields.map((field, index) => {
            const isChanged = field.changeType !== 'unchanged';
            return (
              <div
                key={`target-${field.fieldName}`}
                data-field={field.fieldName}
                data-change-type={field.changeType}
                data-part={isChanged ? 'changed-field' : 'matched-field'}
                aria-label={isChanged ? `Changed field: ${field.fieldName}` : undefined}
                onClick={() => handleNavigate(index)}
              >
                <span data-part="field-label">{field.fieldName}</span>
                <span data-part="field-value">{field.targetValue ?? ''}</span>

                {/* Resolution controls (interactive mode only) */}
                {isChanged && (
                  <div data-part="resolution-controls" hidden={!interactive}>
                    <button
                      data-part="use-left"
                      aria-label={`Use source value for ${field.fieldName}`}
                      onClick={(e) => { e.stopPropagation(); handleUseLeft(field.fieldName); }}
                      type="button"
                    />
                    <button
                      data-part="use-right"
                      aria-label={`Use target value for ${field.fieldName}`}
                      onClick={(e) => { e.stopPropagation(); handleUseRight(field.fieldName); }}
                      type="button"
                    />
                    <button
                      data-part="use-both"
                      aria-label={`Keep both values for ${field.fieldName}`}
                      onClick={(e) => { e.stopPropagation(); handleUseBoth(field.fieldName); }}
                      type="button"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

DiffSideBySide.displayName = 'DiffSideBySide';
export default DiffSideBySide;
