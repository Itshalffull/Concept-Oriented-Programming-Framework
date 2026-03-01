'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { stepIndicatorReducer, type StepStatus } from './StepIndicator.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface StepDef {
  label: string;
  description?: string;
}

export interface StepIndicatorProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Zero-based index of the current step. */
  currentStep?: number;
  /** Array of step definitions. */
  steps: StepDef[];
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Accessible label. */
  ariaLabel?: string;
  /** Whether steps are clickable to navigate. */
  clickable?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Called when a clickable step is selected. */
  onStepClick?: (index: number) => void;
  /** Custom render for step number. */
  renderStepNumber?: (index: number, status: StepStatus) => ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const StepIndicator = forwardRef<HTMLElement, StepIndicatorProps>(function StepIndicator(
  {
    currentStep: controlledStep = 0,
    steps,
    orientation = 'horizontal',
    ariaLabel = 'Progress',
    clickable = false,
    size = 'md',
    onStepClick,
    renderStepNumber,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(stepIndicatorReducer, { currentStep: controlledStep });
  const activeStep = controlledStep ?? state.currentStep;

  const getStatus = useCallback(
    (index: number): StepStatus => {
      if (index < activeStep) return 'completed';
      if (index === activeStep) return 'current';
      return 'upcoming';
    },
    [activeStep],
  );

  const handleStepClick = useCallback(
    (index: number) => {
      if (!clickable) return;
      send({ type: 'GO_TO_STEP', index });
      onStepClick?.(index);
    },
    [clickable, onStepClick],
  );

  const handleStepKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, index: number) => {
      if (!clickable) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStepClick(index);
      }
    },
    [clickable, handleStepClick],
  );

  return (
    <nav
      ref={ref}
      role="navigation"
      aria-label={ariaLabel}
      data-surface-widget=""
      data-widget-name="step-indicator"
      data-part="step-indicator"
      data-orientation={orientation}
      data-size={size}
      data-current-step={activeStep}
      data-total-steps={steps.length}
      {...rest}
    >
      {steps.map((step, index) => {
        const status = getStatus(index);
        const isLast = index === steps.length - 1;

        return (
          <div key={index} data-part="step-wrapper" data-orientation={orientation}>
            <div
              role="listitem"
              aria-current={status === 'current' ? 'step' : undefined}
              aria-label={`Step ${index + 1} of ${steps.length}: ${step.label}, ${status}`}
              data-part="step"
              data-status={status}
              data-index={index}
              data-orientation={orientation}
              data-clickable={clickable ? 'true' : 'false'}
              tabIndex={status === 'current' ? 0 : -1}
              onClick={() => handleStepClick(index)}
              onKeyDown={(e) => handleStepKeyDown(e, index)}
            >
              <span data-part="step-number" data-status={status} aria-hidden="true">
                {renderStepNumber
                  ? renderStepNumber(index, status)
                  : status === 'completed'
                    ? '\u2713'
                    : index + 1}
              </span>
              <span data-part="step-label" data-status={status}>
                {step.label}
              </span>
              {step.description && (
                <span
                  data-part="step-description"
                  data-visible="true"
                  data-status={status}
                >
                  {step.description}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                data-part="connector"
                data-status={index < activeStep ? 'completed' : 'upcoming'}
                data-orientation={orientation}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
});

StepIndicator.displayName = 'StepIndicator';
export { StepIndicator };
export default StepIndicator;
