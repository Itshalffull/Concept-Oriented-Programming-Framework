export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}
