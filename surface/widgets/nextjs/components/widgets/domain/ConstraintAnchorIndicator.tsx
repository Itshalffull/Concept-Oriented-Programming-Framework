'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

import { anchorReducer } from './ConstraintAnchorIndicator.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export type AnchorType = 'pin' | 'align_h' | 'align_v' | 'separate' | 'group_bounds' | 'flow_direction';

export interface ConstraintParameters {
  x?: number;
  y?: number;
  gap?: number;
  axis?: string;
  direction?: string;
}

export interface ConstraintAnchorIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  /** Constraint anchor identifier. */
  anchorId: string;
  /** Type of constraint. */
  anchorType: AnchorType;
  /** IDs of constrained items. */
  targetItems?: string[];
  /** Count of constrained items. */
  targetCount?: number;
  /** Optional constraint parameters. */
  parameters?: ConstraintParameters;
  /** Called when constraint is selected. */
  onSelect?: (anchorId: string) => void;
  /** Called when constraint is deleted. */
  onDelete?: (anchorId: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const ConstraintAnchorIndicator = forwardRef<HTMLDivElement, ConstraintAnchorIndicatorProps>(
  function ConstraintAnchorIndicator(
    {
      anchorId,
      anchorType,
      targetItems = [],
      targetCount = 0,
      parameters,
      onSelect,
      onDelete,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(anchorReducer, 'idle');

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          send({ type: 'DELETE' });
          onDelete?.(anchorId);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          send({ type: 'DESELECT' });
        }
      },
      [anchorId, onDelete],
    );

    if (state === 'deleted') return null;

    const showPin = anchorType === 'pin';
    const showAlignment = anchorType === 'align_h' || anchorType === 'align_v';
    const showSeparation = anchorType === 'separate';

    return (
      <div
        ref={ref}
        role="img"
        aria-label={`${anchorType} constraint on ${targetCount} items`}
        data-surface-widget=""
        data-widget-name="constraint-anchor-indicator"
        data-part="constraint"
        data-anchor-id={anchorId}
        data-type={anchorType}
        data-state={state}
        tabIndex={0}
        onPointerEnter={() => send({ type: 'HOVER' })}
        onPointerLeave={() => send({ type: 'UNHOVER' })}
        onClick={() => {
          send({ type: 'SELECT' });
          onSelect?.(anchorId);
        }}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div
          data-part="pin-icon"
          data-visible={showPin ? 'true' : 'false'}
          aria-hidden="true"
        />

        <div
          data-part="alignment-line"
          data-visible={showAlignment ? 'true' : 'false'}
          data-axis={anchorType === 'align_h' ? 'horizontal' : 'vertical'}
          aria-hidden="true"
        />

        <div
          data-part="separation-arrows"
          data-visible={showSeparation ? 'true' : 'false'}
          aria-hidden="true"
        />
      </div>
    );
  },
);

ConstraintAnchorIndicator.displayName = 'ConstraintAnchorIndicator';
export { ConstraintAnchorIndicator };
export default ConstraintAnchorIndicator;
