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

type VerificationStatus = 'verified' | 'failed' | 'pending' | 'running' | 'timeout' | 'error' | 'skipped';

const STATUS_ICONS: Record<string, string> = {
  verified: '\u2713', failed: '\u2717', pending: '\u25CB', running: '\u23F3',
  timeout: '\u23F0', error: '\u26A0', skipped: '\u2298',
};

const STATUS_LABELS: Record<string, string> = {
  verified: 'Verified', failed: 'Failed', pending: 'Pending', running: 'Running',
  timeout: 'Timeout', error: 'Error', skipped: 'Skipped',
};

export interface VerificationStatusBadgeProps { [key: string]: unknown; class?: string; }
export interface VerificationStatusBadgeResult { element: HTMLElement; dispose: () => void; }

export function VerificationStatusBadge(props: VerificationStatusBadgeProps): VerificationStatusBadgeResult {
  const sig = surfaceCreateSignal<VerificationStatusBadgeState>('idle');
  const send = (type: string) => sig.set(verificationStatusBadgeReducer(sig.get(), { type } as any));

  const status = String(props.status ?? 'pending');
  const label = props.label != null ? String(props.label) : undefined;
  const detail = props.detail != null ? String(props.detail) : undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'verification-status-badge');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', `Verification: ${STATUS_LABELS[status] ?? status}`);
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-status', status);
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const iconEl = document.createElement('div');
  iconEl.setAttribute('data-part', 'icon');
  iconEl.setAttribute('data-status', status);
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = STATUS_ICONS[status] ?? '';
  root.appendChild(iconEl);

  const labelEl = document.createElement('span');
  labelEl.setAttribute('data-part', 'label');
  labelEl.textContent = label ?? STATUS_LABELS[status] ?? status;
  root.appendChild(labelEl);

  const tooltipEl = document.createElement('div');
  tooltipEl.setAttribute('data-part', 'tooltip');
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('data-visible', 'false');
  tooltipEl.style.visibility = 'hidden';
  tooltipEl.style.position = 'absolute';
  if (detail) tooltipEl.textContent = detail;
  root.appendChild(tooltipEl);

  const showTooltip = () => {
    send('HOVER');
    if (detail) { tooltipEl.setAttribute('data-visible', 'true'); tooltipEl.style.visibility = 'visible'; }
  };
  const hideTooltip = () => {
    send('LEAVE');
    tooltipEl.setAttribute('data-visible', 'false');
    tooltipEl.style.visibility = 'hidden';
  };

  root.addEventListener('mouseenter', showTooltip);
  root.addEventListener('mouseleave', hideTooltip);
  root.addEventListener('focus', showTooltip);
  root.addEventListener('blur', hideTooltip);

  const unsub = sig.subscribe((s) => { root.setAttribute('data-state', s); });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default VerificationStatusBadge;
