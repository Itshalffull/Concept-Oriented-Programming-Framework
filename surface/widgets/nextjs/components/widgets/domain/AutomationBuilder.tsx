'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { abReducer } from './AutomationBuilder.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface AutomationStep {
  type: string;
  config?: Record<string, unknown>;
  testResult?: { status: string; [k: string]: unknown };
}

export interface AutomationBuilderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Automation steps. */
  steps: AutomationStep[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Currently selected step index. */
  selectedStepIndex?: number;
  /** Whether testing is active. */
  testingActive?: boolean;
  /** Enable branching. */
  branchingEnabled?: boolean;
  /** Maximum steps. */
  maxSteps?: number;
  /** Automation name. */
  automationName?: string;
  /** Called on steps change. */
  onStepsChange?: (steps: AutomationStep[]) => void;
  /** Called on step select. */
  onStepSelect?: (index: number) => void;
  /** Called on add step. */
  onAddStep?: (afterIndex: number) => void;
  /** Called on test. */
  onTestAll?: () => void;
  /** Step config form slot. */
  stepConfigForm?: ReactNode;
  /** Step type picker slot. */
  stepTypePicker?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const AutomationBuilder = forwardRef<HTMLDivElement, AutomationBuilderProps>(
  function AutomationBuilder(
    {
      steps,
      ariaLabel = 'Automation Builder',
      readOnly = false,
      selectedStepIndex,
      testingActive = false,
      branchingEnabled = true,
      maxSteps = 50,
      automationName = 'Untitled Automation',
      onStepsChange,
      onStepSelect,
      onAddStep,
      onTestAll,
      stepConfigForm,
      stepTypePicker,
      children,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(abReducer, 'idle');

    const handleStepKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>, index: number) => {
        if (e.key === 'Enter') { e.preventDefault(); send({ type: 'CONFIGURE' }); }
        if (e.key === 'Delete') { e.preventDefault(); send({ type: 'DELETE' }); }
      },
      [],
    );

    return (
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        aria-roledescription="automation builder"
        aria-busy={testingActive || state === 'testing' || undefined}
        data-surface-widget=""
        data-widget-name="automation-builder"
        data-state={state}
        data-step-count={steps.length}
        data-readonly={readOnly ? 'true' : 'false'}
        {...rest}
      >
        <div role="list" aria-label="Automation steps" data-part="step-list">
          {steps.map((step, index) => {
            const isSelected = index === selectedStepIndex;
            return (
              <div key={index}>
                {index > 0 && (
                  <div data-part="connector" aria-hidden="true" data-between={`${index - 1}-${index}`} />
                )}
                <div
                  role="listitem"
                  aria-label={`Step ${index}: ${step.type}`}
                  aria-grabbed={state === 'reordering' && isSelected ? true : undefined}
                  aria-current={isSelected ? 'step' : undefined}
                  data-step-index={index}
                  data-step-type={step.type}
                  data-configured={step.config ? 'true' : 'false'}
                  data-test-status={step.testResult?.status ?? 'none'}
                  data-part="step"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => { send({ type: 'SELECT_STEP', index }); onStepSelect?.(index); }}
                  onDoubleClick={() => send({ type: 'CONFIGURE' })}
                  onKeyDown={(e) => handleStepKeyDown(e, index)}
                >
                  <span data-part="step-icon" data-type={step.type} aria-hidden="true" />
                  <span data-part="step-type">{step.type}</span>
                  <div
                    data-part="step-config"
                    role="region"
                    aria-label={`Configuration for step ${index}`}
                    data-state={state === 'configuring' && isSelected ? 'editing' : 'summary'}
                  >
                    {state === 'configuring' && isSelected && stepConfigForm}
                  </div>
                  {step.testResult && (
                    <div
                      data-part="test-panel"
                      role="region"
                      aria-label={`Test results for step ${index}`}
                      aria-live="polite"
                      data-status={step.testResult.status}
                      data-visible="true"
                    />
                  )}
                </div>

                {!readOnly && steps.length < maxSteps && (
                  <button
                    type="button"
                    role="button"
                    aria-label={`Add step after step ${index}`}
                    data-part="add-step"
                    data-after-index={index}
                    data-visible="true"
                    onClick={() => { send({ type: 'ADD_STEP' }); onAddStep?.(index); }}
                  >
                    +
                  </button>
                )}

                {branchingEnabled && !readOnly && (
                  <button
                    type="button"
                    role="button"
                    aria-label="Add conditional branch"
                    data-part="branch-button"
                    data-visible="true"
                  >
                    Branch
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {state === 'addingStep' && stepTypePicker}
        {children}
      </div>
    );
  },
);

AutomationBuilder.displayName = 'AutomationBuilder';
export { AutomationBuilder };
export default AutomationBuilder;
