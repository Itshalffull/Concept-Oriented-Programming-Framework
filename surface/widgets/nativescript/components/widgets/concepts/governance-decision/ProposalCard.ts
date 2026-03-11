import {
  StackLayout,
  GridLayout,
  Label,
  Button,
  TextField,
  TextView,
  ScrollView,
  Progress,
  ActivityIndicator,
  Switch,
  WrapLayout,
  Color,
  View,
} from '@nativescript/core';

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



export interface ProposalCardProps {
  title: string;
  description: string;
  author: string;
  status: string;
  timestamp: string;
  variant?: 'full' | 'compact' | 'minimal';
  showVoteBar?: boolean;
  showQuorum?: boolean;
  truncateDescription?: number;
  onClick?: () => void;
  onNavigate?: () => void;
}

export function createProposalCard(props: ProposalCardProps): { view: View; dispose: () => void } {
  let state: ProposalCardState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: ProposalCardEvent) {
    state = proposalCardReducer(state, event);
    update();
  }

  
  const root = new StackLayout();
  root.className = 'clef-proposal-card';
  root.padding = '12';
  root.borderWidth = 1;
  root.borderColor = new Color('#e5e7eb');
  root.borderRadius = 8;

  const statusLabel = new Label();
  statusLabel.text = props.status;
  statusLabel.fontSize = 11;
  statusLabel.padding = '2 6';
  statusLabel.borderRadius = 4;
  statusLabel.className = 'proposal-status';
  root.addChild(statusLabel);

  const titleLabel = new Label();
  titleLabel.text = props.title;
  titleLabel.fontWeight = 'bold';
  titleLabel.fontSize = 15;
  titleLabel.padding = '4 0';
  titleLabel.textWrap = true;
  root.addChild(titleLabel);

  const descLabel = new Label();
  const maxChars = props.truncateDescription ?? 150;
  descLabel.text = props.description.length > maxChars
    ? props.description.slice(0, maxChars).trimEnd() + '\u2026'
    : props.description;
  descLabel.fontSize = 13;
  descLabel.textWrap = true;
  descLabel.color = new Color('#6b7280');
  root.addChild(descLabel);

  const metaRow = new StackLayout();
  metaRow.orientation = 'horizontal';
  metaRow.padding = '4 0';
  const authorLabel = new Label();
  authorLabel.text = props.author;
  authorLabel.fontSize = 12;
  authorLabel.fontWeight = 'bold';
  metaRow.addChild(authorLabel);
  const tsLabel = new Label();
  tsLabel.text = '  ' + props.timestamp;
  tsLabel.fontSize = 11;
  tsLabel.color = new Color('#9ca3af');
  metaRow.addChild(tsLabel);
  root.addChild(metaRow);

  root.automationText = 'Proposal: ' + props.title;

  const tapHandler = () => {
    send({ type: 'CLICK' });
    props.onClick?.();
    props.onNavigate?.();
    setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 100);
  };
  root.on('tap', tapHandler);
  disposers.push(() => root.off('tap', tapHandler));

  function update() {
    // State-dependent UI updates handled inline
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createProposalCard;
