export type HitlInterruptState = 'pending' | 'editing' | 'approving' | 'rejecting' | 'forking';
export type HitlInterruptEvent =
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'MODIFY' }
  | { type: 'FORK' }
  | { type: 'SAVE' }
  | { type: 'CANCEL' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' };

export function hitlInterruptReducer(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState {
  switch (state) {
    case 'pending':
      if (event.type === 'APPROVE') return 'approving';
      if (event.type === 'REJECT') return 'rejecting';
      if (event.type === 'MODIFY') return 'editing';
      if (event.type === 'FORK') return 'forking';
      return state;
    case 'editing':
      if (event.type === 'SAVE') return 'pending';
      if (event.type === 'CANCEL') return 'pending';
      return state;
    case 'approving':
      if (event.type === 'COMPLETE') return 'resolved';
      if (event.type === 'ERROR') return 'pending';
      return state;
    case 'rejecting':
      if (event.type === 'COMPLETE') return 'resolved';
      return state;
    case 'forking':
      if (event.type === 'COMPLETE') return 'resolved';
      return state;
    default:
      return state;
  }
}

export interface HitlInterruptProps { [key: string]: unknown; }

export function createHitlInterrupt(props: HitlInterruptProps) {
  let state: HitlInterruptState = 'pending';

  function send(type: string) {
    state = hitlInterruptReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createHitlInterrupt;
