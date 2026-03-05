import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ToolInvocationState = 'collapsed' | 'hoveredCollapsed' | 'expanded' | 'pending' | 'running' | 'succeeded' | 'failed';
export type ToolInvocationEvent =
  | { type: 'EXPAND' }
  | { type: 'HOVER' }
  | { type: 'LEAVE' }
  | { type: 'COLLAPSE' }
  | { type: 'INVOKE' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function toolInvocationReducer(state: ToolInvocationState, event: ToolInvocationEvent): ToolInvocationState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND') return 'expanded';
      if (event.type === 'HOVER') return 'hoveredCollapsed';
      return state;
    case 'hoveredCollapsed':
      if (event.type === 'LEAVE') return 'collapsed';
      if (event.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE') return 'collapsed';
      return state;
    case 'pending':
      if (event.type === 'INVOKE') return 'running';
      return state;
    case 'running':
      if (event.type === 'SUCCESS') return 'succeeded';
      if (event.type === 'FAILURE') return 'failed';
      return state;
    case 'succeeded':
      if (event.type === 'RESET') return 'pending';
      return state;
    case 'failed':
      if (event.type === 'RETRY') return 'running';
      if (event.type === 'RESET') return 'pending';
      return state;
    default:
      return state;
  }
}

export interface ToolInvocationProps { [key: string]: unknown; class?: string; }
export interface ToolInvocationResult { element: HTMLElement; dispose: () => void; }

export function ToolInvocation(props: ToolInvocationProps): ToolInvocationResult {
  const sig = surfaceCreateSignal<ToolInvocationState>('collapsed');
  const state = () => sig.get();
  const send = (type: string) => sig.set(toolInvocationReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'tool-invocation');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.setAttribute('aria-label', 'Tool invocation');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  root.addEventListener('mouseenter', () => send('HOVER'));
  root.addEventListener('mouseleave', () => send('LEAVE'));
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const s = sig.get();
      if (s === 'collapsed' || s === 'hoveredCollapsed') send('EXPAND');
      else if (s === 'expanded') send('COLLAPSE');
    }
    if (e.key === 'Escape' && sig.get() === 'expanded') {
      e.preventDefault();
      send('COLLAPSE');
    }
  });

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  headerEl.style.cursor = 'pointer';
  headerEl.addEventListener('click', () => {
    const s = sig.get();
    if (s === 'collapsed' || s === 'hoveredCollapsed') send('EXPAND');
    else if (s === 'expanded') send('COLLAPSE');
  });
  root.appendChild(headerEl);

  const toolIconEl = document.createElement('span');
  toolIconEl.setAttribute('data-part', 'tool-icon');
  toolIconEl.setAttribute('aria-hidden', 'true');
  toolIconEl.textContent = '\u2699';
  headerEl.appendChild(toolIconEl);

  const toolNameEl = document.createElement('span');
  toolNameEl.setAttribute('data-part', 'tool-name');
  headerEl.appendChild(toolNameEl);

  const statusIconEl = document.createElement('span');
  statusIconEl.setAttribute('data-part', 'status-icon');
  statusIconEl.setAttribute('role', 'status');
  headerEl.appendChild(statusIconEl);

  const durationLabelEl = document.createElement('span');
  durationLabelEl.setAttribute('data-part', 'duration-label');
  headerEl.appendChild(durationLabelEl);

  const bodyEl = document.createElement('div');
  bodyEl.setAttribute('data-part', 'body');
  bodyEl.style.display = 'none';
  root.appendChild(bodyEl);

  const argumentsBlockEl = document.createElement('div');
  argumentsBlockEl.setAttribute('data-part', 'arguments-block');
  bodyEl.appendChild(argumentsBlockEl);

  const resultBlockEl = document.createElement('div');
  resultBlockEl.setAttribute('data-part', 'result-block');
  bodyEl.appendChild(resultBlockEl);

  const warningBadgeEl = document.createElement('div');
  warningBadgeEl.setAttribute('data-part', 'warning-badge');
  warningBadgeEl.setAttribute('role', 'alert');
  warningBadgeEl.style.display = 'none';
  bodyEl.appendChild(warningBadgeEl);

  const retryButtonEl = document.createElement('button');
  retryButtonEl.setAttribute('type', 'button');
  retryButtonEl.setAttribute('data-part', 'retry-button');
  retryButtonEl.setAttribute('aria-label', 'Retry tool invocation');
  retryButtonEl.setAttribute('tabindex', '0');
  retryButtonEl.textContent = 'Retry';
  retryButtonEl.style.display = 'none';
  retryButtonEl.addEventListener('click', (e) => { e.stopPropagation(); send('RETRY'); });
  bodyEl.appendChild(retryButtonEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    statusIconEl.setAttribute('data-state', s);
    bodyEl.style.display = s === 'expanded' ? '' : 'none';
    bodyEl.setAttribute('data-visible', s === 'expanded' ? 'true' : 'false');
    resultBlockEl.setAttribute('data-visible', s === 'succeeded' ? 'true' : 'false');
    warningBadgeEl.style.display = s === 'failed' ? '' : 'none';
    retryButtonEl.style.display = s === 'failed' ? '' : 'none';
    const isRunning = s === 'running';
    statusIconEl.textContent = isRunning ? '\u25CB' : s === 'succeeded' ? '\u2713' : s === 'failed' ? '\u2717' : '';
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ToolInvocation;
