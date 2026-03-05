export type QuorumGaugeState = 'belowThreshold' | 'atThreshold' | 'aboveThreshold';
export type QuorumGaugeEvent =
  | { type: 'THRESHOLD_MET' }
  | { type: 'UPDATE' }
  | { type: 'EXCEED' }
  | { type: 'DROP_BELOW' };

export function quorumGaugeReducer(state: QuorumGaugeState, event: QuorumGaugeEvent): QuorumGaugeState {
  switch (state) {
    case 'belowThreshold':
      if (event.type === 'THRESHOLD_MET') return 'atThreshold';
      if (event.type === 'UPDATE') return 'belowThreshold';
      return state;
    case 'atThreshold':
      if (event.type === 'EXCEED') return 'aboveThreshold';
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      return state;
    case 'aboveThreshold':
      if (event.type === 'DROP_BELOW') return 'belowThreshold';
      if (event.type === 'UPDATE') return 'aboveThreshold';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export interface QuorumGaugeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  current: number;
  threshold: number;
  total: number;
  variant?: "simple" | "dynamic" | "dual";
  showLabels?: boolean;
  animate?: boolean;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

const QuorumGauge = forwardRef<HTMLDivElement, QuorumGaugeProps>(function QuorumGauge(
  props,
  ref,
) {
  const [state, send] = useReducer(quorumGaugeReducer, 'belowThreshold');

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label="Progress bar with a threshold marker showing participation p"
      data-surface-widget=""
      data-widget-name="quorum-gauge"
      data-part="root"
      data-state={state}
      tabIndex={0}
      {...props}
    >
        <div data-part="progress-bar" data-state={state}>
          {/* Horizontal bar showing current participation */}
        </div>
        <div data-part="fill" data-state={state}>
          {/* Filled portion of the progress bar */}
        </div>
        <div data-part="threshold-marker" data-state={state}>
          {/* Vertical line marking the quorum threshold */}
        </div>
        <span data-part="current-label" data-state={state}>
          {/* Current count or percentage label */}
        </span>
        <span data-part="threshold-label" data-state={state}>
          {/* Threshold value label */}
        </span>
        <div data-part="status-badge" data-state={state}>
          {/* Badge showing "Quorum met" / "Quorum not met" */}
        </div>
    </div>
  );
});

QuorumGauge.displayName = 'QuorumGauge';
export { QuorumGauge };
export default QuorumGauge;
