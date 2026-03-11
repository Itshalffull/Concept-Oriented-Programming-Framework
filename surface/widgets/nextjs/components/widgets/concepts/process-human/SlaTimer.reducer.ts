export type SlaTimerState = 'onTrack' | 'warning' | 'critical' | 'breached' | 'paused';
export type SlaTimerEvent =
  | { type: 'TICK' }
  | { type: 'WARNING_THRESHOLD' }
  | { type: 'PAUSE' }
  | { type: 'CRITICAL_THRESHOLD' }
  | { type: 'BREACH' }
  | { type: 'RESUME' };

export function slaTimerReducer(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState {
  switch (state) {
    case 'onTrack':
      if (event.type === 'TICK') return 'onTrack';
      if (event.type === 'WARNING_THRESHOLD') return 'warning';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'warning':
      if (event.type === 'TICK') return 'warning';
      if (event.type === 'CRITICAL_THRESHOLD') return 'critical';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'critical':
      if (event.type === 'TICK') return 'critical';
      if (event.type === 'BREACH') return 'breached';
      if (event.type === 'PAUSE') return 'paused';
      return state;
    case 'breached':
      if (event.type === 'TICK') return 'breached';
      return state;
    case 'paused':
      if (event.type === 'RESUME') return 'onTrack';
      return state;
    default:
      return state;
  }
}
