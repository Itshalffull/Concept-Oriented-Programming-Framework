'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { peReducer } from './PolicyEditor.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface ServiceDef {
  name: string;
  actions: string[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface PolicyEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Policy object. */
  policy?: Record<string, unknown>;
  /** JSON string of policy. */
  policyJson?: string;
  /** Available services and their actions. */
  services: ServiceDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Editor mode. */
  mode?: 'visual' | 'json';
  /** Validation errors. */
  validationErrors?: ValidationError[];
  /** Simulation results. */
  simulationResults?: Record<string, unknown>;
  /** Called on mode change. */
  onModeChange?: (mode: 'visual' | 'json') => void;
  /** Called on policy change. */
  onPolicyChange?: (json: string) => void;
  /** Called on validate. */
  onValidate?: () => void;
  /** Called on simulate. */
  onSimulate?: () => void;
  /** Service selector slot. */
  serviceSelector?: ReactNode;
  /** Action selector slot. */
  actionSelector?: ReactNode;
  /** Resource selector slot. */
  resourceSelector?: ReactNode;
  /** JSON editor slot. */
  jsonEditor?: ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const PolicyEditor = forwardRef<HTMLDivElement, PolicyEditorProps>(function PolicyEditor(
  {
    policy,
    policyJson = '{}',
    services,
    ariaLabel = 'Policy Editor',
    readOnly = false,
    mode: controlledMode = 'visual',
    validationErrors = [],
    simulationResults,
    onModeChange,
    onPolicyChange,
    onValidate,
    onSimulate,
    serviceSelector,
    actionSelector,
    resourceSelector,
    jsonEditor,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(peReducer, controlledMode === 'json' ? 'json' : 'visual');
  const isBusy = state === 'validating' || state === 'simulating';
  const isVisual = controlledMode === 'visual';

  const handleModeSwitch = useCallback(
    (targetMode: 'visual' | 'json') => {
      send({ type: targetMode === 'json' ? 'SWITCH_JSON' : 'SWITCH_VISUAL' });
      onModeChange?.(targetMode);
    },
    [onModeChange],
  );

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="policy editor"
      aria-busy={isBusy || undefined}
      data-surface-widget=""
      data-widget-name="policy-editor"
      data-state={state}
      data-mode={controlledMode}
      data-readonly={readOnly ? 'true' : 'false'}
      data-valid={validationErrors.length === 0 ? 'true' : 'false'}
      {...rest}
    >
      <div data-part="mode-toggle" data-mode={controlledMode} aria-label="Editor mode" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={isVisual}
          onClick={() => handleModeSwitch('visual')}
        >
          Visual
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isVisual}
          onClick={() => handleModeSwitch('json')}
        >
          JSON
        </button>
      </div>

      {isVisual && (
        <div
          data-part="visual-editor"
          role="form"
          aria-label="Visual policy editor"
          data-visible="true"
        >
          <div data-part="service-selector" aria-label="Service">
            {serviceSelector}
          </div>
          <div data-part="action-selector" role="group" aria-label="Actions">
            {actionSelector}
          </div>
          <div data-part="resource-selector" aria-label="Resource ARN pattern">
            {resourceSelector}
          </div>
        </div>
      )}

      {!isVisual && (
        <div
          data-part="json-editor"
          role="textbox"
          aria-label="JSON policy editor"
          aria-multiline="true"
          data-visible="true"
          data-valid={validationErrors.length === 0 ? 'true' : 'false'}
          data-error-count={validationErrors.length}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={(e) => onPolicyChange?.((e.target as HTMLElement).textContent ?? '')}
        >
          {jsonEditor ?? policyJson}
        </div>
      )}

      <button
        type="button"
        role="button"
        aria-label="Validate policy"
        data-part="validate"
        data-state={state === 'validating' ? 'loading' : 'idle'}
        aria-disabled={state === 'validating' || undefined}
        onClick={() => { send({ type: 'VALIDATE' }); onValidate?.(); }}
      >
        Validate
      </button>

      <button
        type="button"
        role="button"
        aria-label="Simulate policy"
        data-part="simulate"
        data-state={state === 'simulating' ? 'loading' : 'idle'}
        aria-disabled={state === 'simulating' || validationErrors.length > 0 || undefined}
        onClick={() => { send({ type: 'SIMULATE' }); onSimulate?.(); }}
      >
        Simulate
      </button>

      {children}
    </div>
  );
});

PolicyEditor.displayName = 'PolicyEditor';
export { PolicyEditor };
export default PolicyEditor;
