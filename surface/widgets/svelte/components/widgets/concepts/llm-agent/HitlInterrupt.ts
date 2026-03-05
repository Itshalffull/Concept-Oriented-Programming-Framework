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
    default:
      return state;
  }
}

export interface HitlInterruptProps { [key: string]: unknown; class?: string; }
export interface HitlInterruptResult { element: HTMLElement; dispose: () => void; }

export function HitlInterrupt(props: HitlInterruptProps): HitlInterruptResult {
  const sig = surfaceCreateSignal<HitlInterruptState>('pending');
  const state = () => sig.get();
  const send = (type: string) => sig.set(hitlInterruptReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'hitl-interrupt');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-label', 'Agent requires approval');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const s = sig.get();
    if (s === 'resolved') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      send('REJECT');
    }
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      send('APPROVE');
    }
  });

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const riskBadgeEl = document.createElement('span');
  riskBadgeEl.setAttribute('data-part', 'risk-badge');
  riskBadgeEl.setAttribute('role', 'status');
  headerEl.appendChild(riskBadgeEl);

  const countdownEl = document.createElement('span');
  countdownEl.setAttribute('data-part', 'countdown');
  countdownEl.setAttribute('aria-live', 'polite');
  headerEl.appendChild(countdownEl);

  const resolutionBadgeEl = document.createElement('span');
  resolutionBadgeEl.setAttribute('data-part', 'resolution-badge');
  resolutionBadgeEl.setAttribute('role', 'status');
  resolutionBadgeEl.textContent = 'Resolved';
  resolutionBadgeEl.style.display = 'none';
  headerEl.appendChild(resolutionBadgeEl);

  const reasonTextEl = document.createElement('p');
  reasonTextEl.setAttribute('data-part', 'reason-text');
  root.appendChild(reasonTextEl);

  const stateEditorEl = document.createElement('div');
  stateEditorEl.setAttribute('data-part', 'state-editor');
  stateEditorEl.style.display = 'none';
  root.appendChild(stateEditorEl);

  const contextInputEl = document.createElement('div');
  contextInputEl.setAttribute('data-part', 'context-input');
  root.appendChild(contextInputEl);

  const contextToggleEl = document.createElement('button');
  contextToggleEl.setAttribute('type', 'button');
  contextToggleEl.setAttribute('data-part', 'context-toggle');
  contextToggleEl.setAttribute('aria-label', 'Show additional context');
  contextToggleEl.setAttribute('tabindex', '0');
  contextToggleEl.textContent = '\u25B6 Additional Context';
  contextInputEl.appendChild(contextToggleEl);

  const contextDetailEl = document.createElement('div');
  contextDetailEl.setAttribute('data-part', 'context-detail');
  contextDetailEl.style.display = 'none';
  contextInputEl.appendChild(contextDetailEl);

  let contextExpanded = false;
  contextToggleEl.addEventListener('click', () => {
    contextExpanded = !contextExpanded;
    contextDetailEl.style.display = contextExpanded ? '' : 'none';
    contextToggleEl.setAttribute('aria-expanded', contextExpanded ? 'true' : 'false');
    contextToggleEl.textContent = (contextExpanded ? '\u25BC' : '\u25B6') + ' Additional Context';
  });

  const actionBarEl = document.createElement('div');
  actionBarEl.setAttribute('data-part', 'action-bar');
  root.appendChild(actionBarEl);

  const approveButtonEl = document.createElement('button');
  approveButtonEl.setAttribute('type', 'button');
  approveButtonEl.setAttribute('data-part', 'approve-button');
  approveButtonEl.setAttribute('aria-label', 'Approve');
  approveButtonEl.setAttribute('tabindex', '0');
  approveButtonEl.textContent = 'Approve';
  approveButtonEl.addEventListener('click', () => send('APPROVE'));
  actionBarEl.appendChild(approveButtonEl);

  const rejectButtonEl = document.createElement('button');
  rejectButtonEl.setAttribute('type', 'button');
  rejectButtonEl.setAttribute('data-part', 'reject-button');
  rejectButtonEl.setAttribute('aria-label', 'Deny');
  rejectButtonEl.setAttribute('tabindex', '0');
  rejectButtonEl.textContent = 'Deny';
  rejectButtonEl.addEventListener('click', () => send('REJECT'));
  actionBarEl.appendChild(rejectButtonEl);

  const modifyButtonEl = document.createElement('button');
  modifyButtonEl.setAttribute('type', 'button');
  modifyButtonEl.setAttribute('data-part', 'modify-button');
  modifyButtonEl.setAttribute('aria-label', 'Ask for more info');
  modifyButtonEl.setAttribute('tabindex', '0');
  modifyButtonEl.textContent = 'Ask for more info';
  modifyButtonEl.addEventListener('click', () => send('MODIFY'));
  actionBarEl.appendChild(modifyButtonEl);

  const forkButtonEl = document.createElement('button');
  forkButtonEl.setAttribute('type', 'button');
  forkButtonEl.setAttribute('data-part', 'fork-button');
  forkButtonEl.setAttribute('aria-label', 'Fork');
  forkButtonEl.setAttribute('tabindex', '0');
  forkButtonEl.textContent = 'Fork';
  forkButtonEl.addEventListener('click', () => send('FORK'));
  actionBarEl.appendChild(forkButtonEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    actionBarEl.setAttribute('data-state', s);
    const isResolved = s === 'resolved';
    approveButtonEl.disabled = isResolved;
    rejectButtonEl.disabled = isResolved;
    modifyButtonEl.disabled = isResolved;
    forkButtonEl.disabled = isResolved;
    approveButtonEl.setAttribute('data-state', s);
    rejectButtonEl.setAttribute('data-state', s);
    approveButtonEl.textContent = s === 'approving' ? 'Approving\u2026' : 'Approve';
    rejectButtonEl.textContent = s === 'rejecting' ? 'Denying\u2026' : 'Deny';
    resolutionBadgeEl.style.display = isResolved ? '' : 'none';
    stateEditorEl.style.display = s === 'editing' ? '' : 'none';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default HitlInterrupt;
