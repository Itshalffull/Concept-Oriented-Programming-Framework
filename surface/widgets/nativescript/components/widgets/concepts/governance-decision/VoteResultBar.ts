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

export type VoteResultBarState = 'idle' | 'animating' | 'segmentHovered';
export type VoteResultBarEvent =
  | { type: 'HOVER_SEGMENT' }
  | { type: 'ANIMATE_IN' }
  | { type: 'ANIMATION_END' }
  | { type: 'UNHOVER' };

export function voteResultBarReducer(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER_SEGMENT') return 'segmentHovered';
      if (event.type === 'ANIMATE_IN') return 'animating';
      return state;
    case 'animating':
      if (event.type === 'ANIMATION_END') return 'idle';
      return state;
    case 'segmentHovered':
      if (event.type === 'UNHOVER') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface VoteSegment {
  label: string;
  count: number;
  color?: string;
}

const DEFAULT_COLORS = ['#4caf50', '#f44336', '#ff9800', '#2196f3', '#9c27b0'];

export interface VoteResultBarProps {
  segments: VoteSegment[];
  total?: number;
  variant?: 'binary' | 'multi' | 'weighted';
  showLabels?: boolean;
  showQuorum?: boolean;
  quorumThreshold?: number;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSegmentHover?: (index: number | null, segment: VoteSegment | null) => void;
}

export function createVoteResultBar(props: VoteResultBarProps): { view: View; dispose: () => void } {
  let state: VoteResultBarState = 'idle';
  const disposers: (() => void)[] = [];

  function send(event: VoteResultBarEvent) {
    state = voteResultBarReducer(state, event);
    update();
  }

  
  const total = props.total ?? props.segments.reduce((sum, s) => sum + s.count, 0);

  const root = new StackLayout();
  root.className = 'clef-vote-result-bar';
  root.padding = '8 12';
  root.automationText = 'Vote result bar';

  // Stacked bar
  const bar = new StackLayout();
  bar.orientation = 'horizontal';
  bar.borderRadius = 4;
  bar.height = props.size === 'lg' ? 24 : props.size === 'sm' ? 8 : 16;

  props.segments.forEach((seg, i) => {
    const pct = total > 0 ? (seg.count / total) * 100 : 0;
    const segView = new Label();
    segView.text = '';
    segView.backgroundColor = new Color(seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
    segView.width = { value: pct, unit: '%' } as any;
    segView.height = props.size === 'lg' ? 24 : props.size === 'sm' ? 8 : 16;
    bar.addChild(segView);
  });
  root.addChild(bar);

  // Quorum marker
  if (props.showQuorum && props.quorumThreshold != null) {
    const quorumLabel = new Label();
    quorumLabel.text = `Quorum: ${props.quorumThreshold}%`;
    quorumLabel.fontSize = 11;
    quorumLabel.color = new Color('#6b7280');
    quorumLabel.padding = '2 0';
    root.addChild(quorumLabel);
  }

  // Labels
  if (props.showLabels !== false) {
    const labelRow = new StackLayout();
    labelRow.orientation = 'horizontal';
    labelRow.padding = '4 0';
    props.segments.forEach((seg, i) => {
      const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
      const lbl = new Label();
      lbl.text = `${seg.label}: ${seg.count} (${pct}%)`;
      lbl.fontSize = 12;
      lbl.color = new Color(seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
      lbl.marginRight = 12;
      labelRow.addChild(lbl);
    });
    root.addChild(labelRow);
  }

  // Animation
  if (props.animate) {
    send({ type: 'ANIMATE_IN' });
    const t = setTimeout(() => send({ type: 'ANIMATION_END' }), 300);
    disposers.push(() => clearTimeout(t));
  }

  function update() {
    // State-dependent UI updates handled inline
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createVoteResultBar;
