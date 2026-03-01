export type ThresholdLevel = 'normal' | 'warning' | 'critical' | 'none';

export type GaugeState = { current: 'static' | 'normal' | 'warning' | 'critical' };

export type GaugeAction =
  | { type: 'VALUE_CHANGE' }
  | { type: 'THRESHOLD_WARNING' }
  | { type: 'THRESHOLD_CRITICAL' }
  | { type: 'THRESHOLD_NORMAL' };

export function gaugeReducer(state: GaugeState, action: GaugeAction): GaugeState {
  switch (action.type) {
    case 'THRESHOLD_WARNING':
      return { current: 'warning' };
    case 'THRESHOLD_CRITICAL':
      return { current: 'critical' };
    case 'THRESHOLD_NORMAL':
      return { current: 'normal' };
    case 'VALUE_CHANGE':
      return state;
    default:
      return state;
  }
}

export const gaugeInitialState: GaugeState = { current: 'static' };

export interface GaugeThresholds {
  warning: number;
  critical: number;
}

export function getThresholdLevel(
  value: number,
  thresholds?: GaugeThresholds
): ThresholdLevel {
  if (!thresholds) return 'none';
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'normal';
}

export function getThresholdColor(level: ThresholdLevel): string {
  switch (level) {
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'normal':
      return '#22c55e';
    default:
      return '#6366f1';
  }
}
