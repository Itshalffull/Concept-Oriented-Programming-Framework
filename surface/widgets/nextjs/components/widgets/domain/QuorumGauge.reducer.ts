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
