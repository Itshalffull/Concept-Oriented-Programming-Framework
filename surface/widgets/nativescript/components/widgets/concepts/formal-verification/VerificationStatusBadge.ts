import {
  StackLayout,
  Label,
  Color,
  View,
} from '@nativescript/core';

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

export type VerificationStatus = 'proved' | 'refuted' | 'unknown' | 'timeout' | 'running';

const STATUS_ICONS: Record<VerificationStatus, string> = {
  proved: '\u2713',
  refuted: '\u2717',
  unknown: '?',
  timeout: '\u23F0',
  running: '\u25CB',
};

export interface VerificationStatusBadgeProps {
  status?: VerificationStatus;
  label?: string;
  duration?: number | undefined;
  solver?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function createVerificationStatusBadge(props: VerificationStatusBadgeProps): { view: View; dispose: () => void } {
  let state: VerificationStatusBadgeState = 'idle';
  const disposers: (() => void)[] = [];
  const status = props.status ?? 'unknown';

  function send(event: VerificationStatusBadgeEvent) {
    state = verificationStatusBadgeReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.orientation = 'horizontal';
  root.className = 'clef-verification-status-badge';
  root.automationText = `Verification status: ${props.label ?? 'Unknown'}`;
  root.padding = '4 8';

  const iconLabel = new Label();
  iconLabel.text = STATUS_ICONS[status];
  iconLabel.fontSize = props.size === 'lg' ? 18 : props.size === 'sm' ? 12 : 14;
  iconLabel.marginRight = 4;
  root.addChild(iconLabel);

  const textLabel = new Label();
  textLabel.text = props.label ?? 'Unknown';
  textLabel.fontSize = props.size === 'lg' ? 16 : props.size === 'sm' ? 11 : 13;
  root.addChild(textLabel);

  const tooltipLabel = new Label();
  const tooltipParts: string[] = [];
  if (props.solver) tooltipParts.push(props.solver);
  if (props.duration != null) tooltipParts.push(props.duration + 'ms');
  tooltipLabel.text = tooltipParts.join(' \u2014 ');
  tooltipLabel.fontSize = 11;
  tooltipLabel.color = new Color('#6b7280');
  tooltipLabel.marginLeft = 8;
  tooltipLabel.visibility = 'collapse';
  root.addChild(tooltipLabel);

  // Animate on status change
  const animTimer = setTimeout(() => send({ type: 'ANIMATION_END' }), 200);
  disposers.push(() => clearTimeout(animTimer));

  function update() {
    tooltipLabel.visibility = state === 'hovered' && tooltipParts.length > 0 ? 'visible' : 'collapse';
  }

  update();

  return {
    view: root,
    dispose() { disposers.forEach(d => d()); },
  };
}

export default createVerificationStatusBadge;
