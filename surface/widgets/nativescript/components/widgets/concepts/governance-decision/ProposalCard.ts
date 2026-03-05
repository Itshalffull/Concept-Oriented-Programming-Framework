export type ProposalCardState = 'idle' | 'hovered' | 'focused' | 'navigating';
export type ProposalCardEvent =
  | { type: 'HOVER' }
  | { type: 'FOCUS' }
  | { type: 'CLICK' }
  | { type: 'UNHOVER' }
  | { type: 'BLUR' }
  | { type: 'ENTER' }
  | { type: 'NAVIGATE_COMPLETE' };

export function proposalCardReducer(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      if (event.type === 'ENTER') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ProposalCardProps { [key: string]: unknown; }

export function createProposalCard(props: ProposalCardProps) {
  let state: ProposalCardState = 'idle';

  function send(type: string) {
    state = proposalCardReducer(state, { type } as any);
  }

  return { send, getState: () => state };
}

export default createProposalCard;
