'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ChangeEvent,
} from 'react';

import { layoutPanelReducer } from './LayoutControlPanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface LayoutAlgorithm {
  name: string;
  label: string;
}

export interface LayoutControlPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Canvas this panel controls. */
  canvasId: string;
  /** Available layout algorithms. */
  algorithms?: LayoutAlgorithm[];
  /** Currently selected algorithm. */
  selectedAlgorithm?: string;
  /** Layout direction. */
  direction?: 'top-to-bottom' | 'left-to-right' | 'bottom-to-top' | 'right-to-left';
  /** Horizontal spacing between nodes. */
  spacingX?: number;
  /** Vertical spacing between nodes. */
  spacingY?: number;
  /** Called when algorithm changes. */
  onAlgorithmChange?: (algorithm: string) => void;
  /** Called when direction changes. */
  onDirectionChange?: (direction: string) => void;
  /** Called when spacing changes. */
  onSpacingChange?: (x: number, y: number) => void;
  /** Called when layout is applied. */
  onApply?: (algorithm: string, direction: string, spacingX: number, spacingY: number) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const LayoutControlPanel = forwardRef<HTMLDivElement, LayoutControlPanelProps>(
  function LayoutControlPanel(
    {
      canvasId,
      algorithms = [],
      selectedAlgorithm,
      direction = 'top-to-bottom',
      spacingX = 80,
      spacingY = 100,
      onAlgorithmChange,
      onDirectionChange,
      onSpacingChange,
      onApply,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(layoutPanelReducer, 'idle');

    const handleAlgorithmChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        send({ type: 'SELECT_ALGORITHM', algorithm: value });
        onAlgorithmChange?.(value);
      },
      [onAlgorithmChange],
    );

    const handleDirectionChange = useCallback(
      (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        send({ type: 'SET_DIRECTION', direction: value });
        onDirectionChange?.(value);
      },
      [onDirectionChange],
    );

    const handleSpacingChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        send({ type: 'SET_SPACING', spacing: value });
        onSpacingChange?.(value, spacingY);
      },
      [spacingY, onSpacingChange],
    );

    const handleApply = useCallback(() => {
      if (!selectedAlgorithm || state === 'applying') return;
      send({ type: 'APPLY' });
      onApply?.(selectedAlgorithm, direction, spacingX, spacingY);
    }, [selectedAlgorithm, state, direction, spacingX, spacingY, onApply]);

    return (
      <div
        ref={ref}
        role="form"
        aria-label="Layout controls"
        data-surface-widget=""
        data-widget-name="layout-control-panel"
        data-part="layout-control"
        data-canvas={canvasId}
        data-state={state}
        {...rest}
      >
        <select
          data-part="algorithm-selector"
          role="listbox"
          aria-label="Layout algorithm"
          value={selectedAlgorithm ?? ''}
          onChange={handleAlgorithmChange}
        >
          <option value="" disabled>Select algorithm...</option>
          {algorithms.map((a) => (
            <option key={a.name} value={a.name}>{a.label}</option>
          ))}
        </select>

        <select
          data-part="direction-selector"
          aria-label="Layout direction"
          value={direction}
          onChange={handleDirectionChange}
        >
          <option value="top-to-bottom">Top to Bottom</option>
          <option value="left-to-right">Left to Right</option>
          <option value="bottom-to-top">Bottom to Top</option>
          <option value="right-to-left">Right to Left</option>
        </select>

        <input
          data-part="spacing-slider"
          type="range"
          aria-label="Node spacing"
          min={20}
          max={200}
          value={spacingX}
          onChange={handleSpacingChange}
        />

        <button
          data-part="apply-button"
          role="button"
          aria-label="Apply layout"
          aria-disabled={state === 'idle' ? 'true' : 'false'}
          disabled={state === 'idle' || state === 'applying'}
          onClick={handleApply}
        >
          {state === 'applying' ? 'Applying...' : 'Apply Layout'}
        </button>
      </div>
    );
  },
);

LayoutControlPanel.displayName = 'LayoutControlPanel';
export { LayoutControlPanel };
export default LayoutControlPanel;
