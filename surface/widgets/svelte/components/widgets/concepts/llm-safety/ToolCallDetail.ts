import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent =
  | { type: 'EXPAND_ARGS' }
  | { type: 'EXPAND_RESULT' }
  | { type: 'RETRY' }
  | { type: 'RETRY_COMPLETE' }
  | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle':
      if (event.type === 'EXPAND_ARGS') return 'idle';
      if (event.type === 'EXPAND_RESULT') return 'idle';
      if (event.type === 'RETRY') return 'retrying';
      return state;
    case 'retrying':
      if (event.type === 'RETRY_COMPLETE') return 'idle';
      if (event.type === 'RETRY_ERROR') return 'idle';
      return state;
    default:
      return state;
  }
}

export interface ToolCallDetailProps { [key: string]: unknown; class?: string; }
export interface ToolCallDetailResult { element: HTMLElement; dispose: () => void; }

export function ToolCallDetail(props: ToolCallDetailProps): ToolCallDetailResult {
  const sig = surfaceCreateSignal<ToolCallDetailState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(toolCallDetailReducer(sig.get(), { type } as any));

  let argsExpanded = false;
  let resultExpanded = false;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'tool-call-detail');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'article');
  root.setAttribute('aria-label', 'Tool call detail');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const headerEl = document.createElement('div');
  headerEl.setAttribute('data-part', 'header');
  root.appendChild(headerEl);

  const toolNameEl = document.createElement('span');
  toolNameEl.setAttribute('data-part', 'tool-name');
  headerEl.appendChild(toolNameEl);

  const statusBadgeEl = document.createElement('span');
  statusBadgeEl.setAttribute('data-part', 'status-badge');
  statusBadgeEl.setAttribute('role', 'status');
  headerEl.appendChild(statusBadgeEl);

  const timingBarEl = document.createElement('div');
  timingBarEl.setAttribute('data-part', 'timing-bar');
  timingBarEl.setAttribute('aria-label', 'Call timing');
  root.appendChild(timingBarEl);

  const tokenBadgeEl = document.createElement('span');
  tokenBadgeEl.setAttribute('data-part', 'token-badge');
  tokenBadgeEl.setAttribute('aria-label', 'Token usage');
  root.appendChild(tokenBadgeEl);

  const argumentsPanelEl = document.createElement('div');
  argumentsPanelEl.setAttribute('data-part', 'arguments-panel');
  root.appendChild(argumentsPanelEl);

  const argsToggleEl = document.createElement('button');
  argsToggleEl.setAttribute('type', 'button');
  argsToggleEl.setAttribute('data-part', 'args-toggle');
  argsToggleEl.setAttribute('aria-expanded', 'false');
  argsToggleEl.setAttribute('aria-label', 'Toggle arguments');
  argsToggleEl.setAttribute('tabindex', '0');
  argsToggleEl.textContent = '\u25B6 Arguments';
  argsToggleEl.addEventListener('click', () => {
    argsExpanded = !argsExpanded;
    argsToggleEl.setAttribute('aria-expanded', argsExpanded ? 'true' : 'false');
    argsToggleEl.textContent = (argsExpanded ? '\u25BC' : '\u25B6') + ' Arguments';
    argsContentEl.style.display = argsExpanded ? '' : 'none';
    send('EXPAND_ARGS');
  });
  argumentsPanelEl.appendChild(argsToggleEl);

  const argsContentEl = document.createElement('pre');
  argsContentEl.setAttribute('data-part', 'args-content');
  argsContentEl.style.display = 'none';
  argumentsPanelEl.appendChild(argsContentEl);

  const resultPanelEl = document.createElement('div');
  resultPanelEl.setAttribute('data-part', 'result-panel');
  root.appendChild(resultPanelEl);

  const resultToggleEl = document.createElement('button');
  resultToggleEl.setAttribute('type', 'button');
  resultToggleEl.setAttribute('data-part', 'result-toggle');
  resultToggleEl.setAttribute('aria-expanded', 'false');
  resultToggleEl.setAttribute('aria-label', 'Toggle result');
  resultToggleEl.setAttribute('tabindex', '0');
  resultToggleEl.textContent = '\u25B6 Result';
  resultToggleEl.addEventListener('click', () => {
    resultExpanded = !resultExpanded;
    resultToggleEl.setAttribute('aria-expanded', resultExpanded ? 'true' : 'false');
    resultToggleEl.textContent = (resultExpanded ? '\u25BC' : '\u25B6') + ' Result';
    resultContentEl.style.display = resultExpanded ? '' : 'none';
    send('EXPAND_RESULT');
  });
  resultPanelEl.appendChild(resultToggleEl);

  const resultContentEl = document.createElement('pre');
  resultContentEl.setAttribute('data-part', 'result-content');
  resultContentEl.style.display = 'none';
  resultPanelEl.appendChild(resultContentEl);

  const errorPanelEl = document.createElement('div');
  errorPanelEl.setAttribute('data-part', 'error-panel');
  errorPanelEl.setAttribute('role', 'alert');
  root.appendChild(errorPanelEl);

  const retryButtonEl = document.createElement('button');
  retryButtonEl.setAttribute('type', 'button');
  retryButtonEl.setAttribute('data-part', 'retry-button');
  retryButtonEl.setAttribute('aria-label', 'Retry tool call');
  retryButtonEl.setAttribute('tabindex', '0');
  retryButtonEl.textContent = 'Retry';
  retryButtonEl.addEventListener('click', () => send('RETRY'));
  root.appendChild(retryButtonEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    headerEl.setAttribute('data-state', s);
    statusBadgeEl.setAttribute('data-state', s);
    retryButtonEl.disabled = s === 'retrying';
    retryButtonEl.textContent = s === 'retrying' ? 'Retrying...' : 'Retry';
    retryButtonEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default ToolCallDetail;
