import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type HitlInterruptState = 'pending' | 'editing' | 'approving' | 'rejecting' | 'forking' | 'resolved';
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
    case 'resolved':
      return state;
    default:
      return state;
  }
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
const RISK_CONFIG: Record<RiskLevel, { label: string; icon: string }> = {
  low: { label: 'Low Risk', icon: '\u2713' },
  medium: { label: 'Medium Risk', icon: '\u26A0' },
  high: { label: 'High Risk', icon: '\u2622' },
  critical: { label: 'Critical Risk', icon: '\u2716' },
};

export interface HitlInterruptProps { [key: string]: unknown; class?: string; }
export interface HitlInterruptResult { element: HTMLElement; dispose: () => void; }

export function HitlInterrupt(props: HitlInterruptProps): HitlInterruptResult {
  const sig = surfaceCreateSignal<HitlInterruptState>('pending');
  const send = (event: HitlInterruptEvent) => { sig.set(hitlInterruptReducer(sig.get(), event)); };

  const action = String(props.action ?? '');
  const reason = String(props.reason ?? '');
  const risk = (props.risk ?? 'medium') as RiskLevel;
  const context = props.context as string | undefined;
  const onApprove = props.onApprove as (() => void) | undefined;
  const onDeny = props.onDeny as (() => void) | undefined;
  const onRequestInfo = props.onRequestInfo as (() => void) | undefined;
  const autoDenySeconds = props.autoDenySeconds as number | undefined;

  const riskInfo = RISK_CONFIG[risk];
  let countdown = autoDenySeconds ?? 0;
  let countdownInterval: ReturnType<typeof setInterval> | undefined;
  let contextExpanded = false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'hitl-interrupt');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-risk', risk);
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-label', 'Agent requires approval');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Header
  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.setAttribute('data-state', sig.get());
  headerEl.setAttribute('data-risk', risk);
  root.appendChild(headerEl);

  const riskBadge = document.createElement('span');
  riskBadge.setAttribute('data-part', 'risk-badge');
  riskBadge.setAttribute('data-risk', risk);
  riskBadge.setAttribute('role', 'status');
  riskBadge.setAttribute('aria-label', riskInfo.label);
  riskBadge.textContent = `${riskInfo.icon} ${riskInfo.label}`;
  headerEl.appendChild(riskBadge);

  const countdownEl = document.createElement('span');
  countdownEl.setAttribute('data-part', 'countdown');
  countdownEl.setAttribute('aria-live', 'polite');
  if (autoDenySeconds != null && autoDenySeconds > 0) {
    countdownEl.setAttribute('aria-label', `Auto-deny in ${countdown} seconds`);
    countdownEl.textContent = `Auto-deny in ${countdown}s`;
  } else {
    countdownEl.style.display = 'none';
  }
  headerEl.appendChild(countdownEl);

  // Action
  const actionEl = document.createElement('div');
  actionEl.setAttribute('data-part', 'action');
  const actionStrong = document.createElement('strong');
  actionStrong.textContent = 'Action:';
  actionEl.appendChild(actionStrong);
  actionEl.appendChild(document.createTextNode(` ${action}`));
  root.appendChild(actionEl);

  // Reason
  const reasonEl = document.createElement('p');
  reasonEl.setAttribute('data-part', 'reason');
  const reasonStrong = document.createElement('strong');
  reasonStrong.textContent = 'Reason:';
  reasonEl.appendChild(reasonStrong);
  reasonEl.appendChild(document.createTextNode(` ${reason}`));
  root.appendChild(reasonEl);

  // Context
  if (context != null) {
    const contextDiv = document.createElement('div');
    contextDiv.setAttribute('data-part', 'context');
    contextDiv.setAttribute('data-expanded', 'false');

    const contextToggle = document.createElement('button');
    contextToggle.setAttribute('type', 'button');
    contextToggle.setAttribute('data-part', 'context-toggle');
    contextToggle.setAttribute('aria-expanded', 'false');
    contextToggle.setAttribute('aria-label', 'Show additional context');
    contextToggle.setAttribute('tabindex', '0');
    contextToggle.textContent = '\u25B6 Additional Context';
    contextDiv.appendChild(contextToggle);

    const contextDetail = document.createElement('div');
    contextDetail.setAttribute('data-part', 'context-detail');
    contextDetail.setAttribute('aria-label', 'Additional context');
    contextDetail.textContent = context;
    contextDetail.style.display = 'none';
    contextDiv.appendChild(contextDetail);

    contextToggle.addEventListener('click', () => {
      contextExpanded = !contextExpanded;
      contextDiv.setAttribute('data-expanded', String(contextExpanded));
      contextToggle.setAttribute('aria-expanded', String(contextExpanded));
      contextToggle.setAttribute('aria-label', contextExpanded ? 'Hide additional context' : 'Show additional context');
      contextToggle.textContent = `${contextExpanded ? '\u25BC' : '\u25B6'} Additional Context`;
      contextDetail.style.display = contextExpanded ? '' : 'none';
    });

    root.appendChild(contextDiv);
  }

  // Action bar
  const actionBar = document.createElement('div');
  actionBar.setAttribute('data-part', 'action-bar');
  actionBar.setAttribute('data-state', sig.get());
  root.appendChild(actionBar);

  const approveBtn = document.createElement('button');
  approveBtn.setAttribute('type', 'button');
  approveBtn.setAttribute('data-part', 'approve');
  approveBtn.setAttribute('data-state', sig.get());
  approveBtn.setAttribute('aria-label', 'Approve');
  approveBtn.setAttribute('tabindex', '0');
  approveBtn.textContent = 'Approve';
  approveBtn.addEventListener('click', () => {
    if (sig.get() === 'resolved') return;
    send({ type: 'APPROVE' });
    onApprove?.();
  });
  actionBar.appendChild(approveBtn);

  const denyBtn = document.createElement('button');
  denyBtn.setAttribute('type', 'button');
  denyBtn.setAttribute('data-part', 'deny');
  denyBtn.setAttribute('data-state', sig.get());
  denyBtn.setAttribute('aria-label', 'Deny');
  denyBtn.setAttribute('tabindex', '0');
  denyBtn.textContent = 'Deny';
  denyBtn.addEventListener('click', () => {
    if (sig.get() === 'resolved') return;
    send({ type: 'REJECT' });
    onDeny?.();
  });
  actionBar.appendChild(denyBtn);

  const infoBtn = document.createElement('button');
  infoBtn.setAttribute('type', 'button');
  infoBtn.setAttribute('data-part', 'request-info');
  infoBtn.setAttribute('data-state', sig.get());
  infoBtn.setAttribute('aria-label', 'Ask for more info');
  infoBtn.setAttribute('tabindex', '0');
  infoBtn.textContent = 'Ask for more info';
  infoBtn.addEventListener('click', () => {
    if (sig.get() === 'resolved') return;
    onRequestInfo?.();
  });
  actionBar.appendChild(infoBtn);

  // Auto-deny countdown
  if (autoDenySeconds != null && autoDenySeconds > 0) {
    countdownInterval = setInterval(() => {
      if (sig.get() === 'resolved') { clearInterval(countdownInterval); return; }
      countdown -= 1;
      countdownEl.textContent = `Auto-deny in ${countdown}s`;
      countdownEl.setAttribute('aria-label', `Auto-deny in ${countdown} seconds`);
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        if (sig.get() !== 'resolved') { send({ type: 'REJECT' }); onDeny?.(); }
      }
    }, 1000);
  }

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (sig.get() === 'resolved') return;
    const target = e.target as HTMLElement;
    if (e.key === 'Escape') { e.preventDefault(); send({ type: 'REJECT' }); onDeny?.(); }
    if (e.key === 'Enter' && target.tagName !== 'BUTTON') { e.preventDefault(); send({ type: 'APPROVE' }); onApprove?.(); }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    const isResolved = s === 'resolved';
    approveBtn.disabled = isResolved;
    denyBtn.disabled = isResolved;
    infoBtn.disabled = isResolved;
    approveBtn.setAttribute('data-state', s);
    approveBtn.textContent = s === 'approving' ? 'Approving\u2026' : 'Approve';
    denyBtn.setAttribute('data-state', s);
    denyBtn.textContent = s === 'rejecting' ? 'Denying\u2026' : 'Deny';
    if (isResolved) {
      countdownEl.style.display = 'none';
      if (countdownInterval) clearInterval(countdownInterval);
    }
  });

  return {
    element: root,
    dispose() { unsub(); if (countdownInterval) clearInterval(countdownInterval); root.remove(); },
  };
}

export default HitlInterrupt;
