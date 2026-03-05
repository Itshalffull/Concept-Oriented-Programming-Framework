import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type GenerationIndicatorState = 'idle' | 'generating' | 'complete' | 'error';
export type GenerationIndicatorEvent =
  | { type: 'START' }
  | { type: 'TOKEN' }
  | { type: 'COMPLETE' }
  | { type: 'ERROR' }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export function generationIndicatorReducer(state: GenerationIndicatorState, event: GenerationIndicatorEvent): GenerationIndicatorState {
  switch (state) {
    case 'idle':
      if (event.type === 'START') return 'generating';
      return state;
    case 'generating':
      if (event.type === 'TOKEN') return 'generating';
      if (event.type === 'COMPLETE') return 'complete';
      if (event.type === 'ERROR') return 'error';
      return state;
    case 'complete':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'START') return 'generating';
      return state;
    case 'error':
      if (event.type === 'RESET') return 'idle';
      if (event.type === 'RETRY') return 'generating';
      return state;
    default:
      return state;
  }
}

export interface GenerationIndicatorProps { [key: string]: unknown; class?: string; }
export interface GenerationIndicatorResult { element: HTMLElement; dispose: () => void; }

export function GenerationIndicator(props: GenerationIndicatorProps): GenerationIndicatorResult {
  const sig = surfaceCreateSignal<GenerationIndicatorState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(generationIndicatorReducer(sig.get(), { type } as any));

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'generation-indicator');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', 'Generation status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  const spinnerEl = document.createElement('div');
  spinnerEl.setAttribute('data-part', 'spinner');
  spinnerEl.setAttribute('aria-hidden', 'true');
  spinnerEl.style.display = 'none';
  root.appendChild(spinnerEl);

  const statusTextEl = document.createElement('span');
  statusTextEl.setAttribute('data-part', 'status-text');
  statusTextEl.textContent = 'Idle';
  root.appendChild(statusTextEl);

  const modelBadgeEl = document.createElement('span');
  modelBadgeEl.setAttribute('data-part', 'model-badge');
  root.appendChild(modelBadgeEl);

  const tokenCounterEl = document.createElement('span');
  tokenCounterEl.setAttribute('data-part', 'token-counter');
  tokenCounterEl.setAttribute('aria-label', 'Token count');
  root.appendChild(tokenCounterEl);

  const elapsedEl = document.createElement('span');
  elapsedEl.setAttribute('data-part', 'elapsed');
  elapsedEl.setAttribute('aria-label', 'Elapsed time');
  root.appendChild(elapsedEl);

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    spinnerEl.style.display = s === 'generating' ? '' : 'none';
    spinnerEl.setAttribute('data-visible', s === 'generating' ? 'true' : 'false');
    const labels: Record<string, string> = { idle: 'Idle', generating: 'Generating...', complete: 'Complete', error: 'Error' };
    statusTextEl.textContent = labels[s] ?? s;
    statusTextEl.setAttribute('data-state', s);
    tokenCounterEl.setAttribute('data-visible', s === 'generating' || s === 'complete' ? 'true' : 'false');
    elapsedEl.setAttribute('data-visible', s === 'generating' ? 'true' : 'false');
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default GenerationIndicator;
