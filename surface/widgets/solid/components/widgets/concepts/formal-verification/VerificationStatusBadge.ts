import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

export interface VerificationStatusBadgeProps { [key: string]: unknown; class?: string; }
export interface VerificationStatusBadgeResult { element: HTMLElement; dispose: () => void; }

export function VerificationStatusBadge(props: VerificationStatusBadgeProps): VerificationStatusBadgeResult {
  const sig = surfaceCreateSignal<VerificationStatusBadgeState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(verificationStatusBadgeReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];
  let animationTimer: ReturnType<typeof setTimeout> | undefined;
  let reducedMotion = false;

  /* Detect prefers-reduced-motion */
  if (typeof window !== 'undefined') {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;
    const motionHandler = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    mql.addEventListener('change', motionHandler);
    unsubs.push(() => mql.removeEventListener('change', motionHandler));
  }

  const tooltipId = `vsb-tooltip-${Math.random().toString(36).slice(2, 9)}`;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'verification-status-badge');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'Verification status: Unknown');
  root.setAttribute('data-state', state());
  root.setAttribute('data-status', 'unknown');
  root.setAttribute('data-size', 'md');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Icon */
  const iconEl = document.createElement('span');
  iconEl.setAttribute('data-part', 'icon');
  iconEl.setAttribute('data-status', 'unknown');
  iconEl.setAttribute('aria-hidden', 'true');
  root.appendChild(iconEl);

  /* Label */
  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  labelEl.textContent = 'Unknown';
  root.appendChild(labelEl);

  /* Tooltip */
  const tooltipEl = document.createElement('div');
  tooltipEl.id = tooltipId;
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('data-visible', 'false');
  tooltipEl.setAttribute('aria-hidden', 'true');
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.pointerEvents = 'none';
  root.appendChild(tooltipEl);

  /* Pointer / focus event handlers */
  root.addEventListener('pointerenter', () => send('HOVER'));
  root.addEventListener('pointerleave', () => send('LEAVE'));
  root.addEventListener('focus', () => send('HOVER'));
  root.addEventListener('blur', () => send('LEAVE'));

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isHovered = s === 'hovered';
    tooltipEl.setAttribute('data-visible', isHovered ? 'true' : 'false');
    tooltipEl.setAttribute('aria-hidden', isHovered ? 'false' : 'true');
    tooltipEl.style.visibility = isHovered ? 'visible' : 'hidden';
    if (s === 'animating') {
      const ms = reducedMotion ? 0 : 200;
      if (animationTimer) clearTimeout(animationTimer);
      animationTimer = setTimeout(() => send('ANIMATION_END'), ms);
    }
  }));

  return {
    element: root,
    dispose() {
      unsubs.forEach((u) => u());
      if (animationTimer) clearTimeout(animationTimer);
      root.remove();
    },
  };
}

export default VerificationStatusBadge;
