export type VerificationStatusBadgeState = 'idle' | 'hovered' | 'animating';
export type VerificationStatusBadgeEvent =
  | { type: 'HOVER' }
  | { type: 'STATUS_CHANGE' }
  | { type: 'LEAVE' }
  | { type: 'ANIMATION_END' };

export function verificationStatusBadgeReducer(state: VerificationStatusBadgeState, event: VerificationStatusBadgeEvent): VerificationStatusBadgeState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'STATUS_CHANGE') return 'animating';
      return state;
    case 'hovered':
      if (event.type === 'LEAVE') return 'idle';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface VerificationStatusBadgeProps { [key: string]: unknown; }

export function createVerificationStatusBadge(props: VerificationStatusBadgeProps) {
  let state: VerificationStatusBadgeState = 'idle';

  function send(type: string) {
    state = verificationStatusBadgeReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createVerificationStatusBadge;
