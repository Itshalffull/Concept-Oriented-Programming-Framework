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

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export interface GenerationIndicatorProps { [key: string]: unknown; class?: string; }
export interface GenerationIndicatorResult { element: HTMLElement; dispose: () => void; }

export function GenerationIndicator(props: GenerationIndicatorProps): GenerationIndicatorResult {
  const sig = surfaceCreateSignal<GenerationIndicatorState>('idle');
  const send = (event: GenerationIndicatorEvent) => { sig.set(generationIndicatorReducer(sig.get(), event)); };

  const status = (props.status ?? 'idle') as GenerationIndicatorState;
  const model = props.model as string | undefined;
  const tokenCount = props.tokenCount as number | undefined;
  const showTokens = props.showTokens !== false;
  const showModel = props.showModel !== false;
  const showElapsed = props.showElapsed !== false;
  const variant = (props.variant ?? 'dots') as 'dots' | 'spinner' | 'bar';
  const cancelable = props.cancelable === true;
  const onCancel = props.onCancel as (() => void) | undefined;
  const onRetry = props.onRetry as (() => void) | undefined;

  let elapsedSeconds = 0;
  let finalElapsed = 0;
  let elapsedInterval: ReturnType<typeof setInterval> | undefined;

  // Sync with status prop
  if (status === 'generating') {
    send({ type: 'START' });
  } else if (status === 'complete') {
    send({ type: 'START' });
    send({ type: 'COMPLETE' });
  } else if (status === 'error') {
    send({ type: 'START' });
    send({ type: 'ERROR' });
  }

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'generation-indicator');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('data-variant', variant);
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', `Generation ${sig.get()}`);
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-busy', String(sig.get() === 'generating'));
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Spinner
  const spinnerEl = document.createElement('div');
  spinnerEl.setAttribute('data-part', 'spinner');
  spinnerEl.setAttribute('data-state', sig.get());
  spinnerEl.setAttribute('data-visible', sig.get() === 'generating' ? 'true' : 'false');
  spinnerEl.setAttribute('data-variant', variant);
  spinnerEl.setAttribute('aria-hidden', 'true');
  root.appendChild(spinnerEl);

  const renderSpinner = () => {
    spinnerEl.innerHTML = '';
    if (sig.get() !== 'generating') {
      spinnerEl.setAttribute('data-visible', 'false');
      return;
    }
    spinnerEl.setAttribute('data-visible', 'true');

    if (variant === 'dots') {
      const dots = document.createElement('span');
      dots.setAttribute('data-part', 'spinner-dots');
      dots.setAttribute('aria-hidden', 'true');
      dots.textContent = '...';
      spinnerEl.appendChild(dots);
    } else if (variant === 'spinner') {
      const icon = document.createElement('span');
      icon.setAttribute('data-part', 'spinner-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.style.display = 'inline-block';
      icon.innerHTML = '&#x21BB;';
      spinnerEl.appendChild(icon);
    } else if (variant === 'bar') {
      const bar = document.createElement('span');
      bar.setAttribute('data-part', 'spinner-bar');
      bar.setAttribute('aria-hidden', 'true');
      bar.setAttribute('role', 'progressbar');
      bar.style.display = 'inline-block';
      bar.style.width = '4em';
      bar.style.height = '0.5em';
      bar.style.backgroundColor = 'currentColor';
      bar.style.opacity = '0.2';
      bar.style.position = 'relative';
      bar.style.overflow = 'hidden';
      bar.style.borderRadius = '0.25em';
      const fill = document.createElement('span');
      fill.setAttribute('data-part', 'spinner-bar-fill');
      fill.style.position = 'absolute';
      fill.style.width = '40%';
      fill.style.height = '100%';
      fill.style.backgroundColor = 'currentColor';
      fill.style.opacity = '1';
      bar.appendChild(fill);
      spinnerEl.appendChild(bar);
    }
  };

  // Status text
  const statusTextEl = document.createElement('span');
  statusTextEl.setAttribute('data-part', 'status-text');
  statusTextEl.setAttribute('data-state', sig.get());
  root.appendChild(statusTextEl);

  const updateStatusText = () => {
    const s = sig.get();
    statusTextEl.setAttribute('data-state', s);
    switch (s) {
      case 'generating': statusTextEl.textContent = 'Generating...'; break;
      case 'complete': statusTextEl.textContent = 'Complete'; break;
      case 'error': statusTextEl.textContent = 'Error'; break;
      default: statusTextEl.textContent = ''; break;
    }
  };

  // Model badge
  const modelBadgeEl = document.createElement('div');
  modelBadgeEl.setAttribute('data-part', 'model-badge');
  modelBadgeEl.setAttribute('data-state', sig.get());
  modelBadgeEl.setAttribute('role', 'presentation');
  if (showModel && model) {
    modelBadgeEl.setAttribute('data-visible', 'true');
    modelBadgeEl.textContent = model;
  } else {
    modelBadgeEl.style.display = 'none';
  }
  root.appendChild(modelBadgeEl);

  // Token counter
  const tokenCounterEl = document.createElement('span');
  tokenCounterEl.setAttribute('data-part', 'token-counter');
  tokenCounterEl.setAttribute('data-state', sig.get());
  if (showTokens && tokenCount != null) {
    tokenCounterEl.setAttribute('data-visible', 'true');
    tokenCounterEl.setAttribute('role', 'status');
    tokenCounterEl.setAttribute('aria-label', `${tokenCount} tokens generated`);
    tokenCounterEl.textContent = `${tokenCount} tokens`;
  } else {
    tokenCounterEl.style.display = 'none';
  }
  root.appendChild(tokenCounterEl);

  // Elapsed
  const elapsedEl = document.createElement('span');
  elapsedEl.setAttribute('data-part', 'elapsed');
  elapsedEl.setAttribute('data-state', sig.get());
  root.appendChild(elapsedEl);

  const updateElapsed = () => {
    const s = sig.get();
    elapsedEl.setAttribute('data-state', s);
    if (s === 'generating') {
      elapsedEl.setAttribute('data-visible', 'true');
      elapsedEl.textContent = formatElapsed(elapsedSeconds);
      if (showElapsed) elapsedEl.style.display = '';
      else elapsedEl.style.display = 'none';
    } else if (s === 'complete') {
      elapsedEl.setAttribute('data-visible', 'false');
      elapsedEl.textContent = formatElapsed(finalElapsed);
      if (showElapsed) elapsedEl.style.display = '';
      else elapsedEl.style.display = 'none';
    } else {
      elapsedEl.style.display = 'none';
    }
  };

  // Retry button
  const retryBtnEl = document.createElement('button');
  retryBtnEl.setAttribute('type', 'button');
  retryBtnEl.setAttribute('data-part', 'retry-button');
  retryBtnEl.setAttribute('data-state', sig.get());
  retryBtnEl.setAttribute('aria-label', 'Retry generation');
  retryBtnEl.setAttribute('tabindex', '0');
  retryBtnEl.textContent = 'Retry';
  retryBtnEl.style.display = sig.get() === 'error' ? '' : 'none';
  retryBtnEl.addEventListener('click', () => {
    if (sig.get() === 'error') {
      onRetry?.();
    }
  });
  root.appendChild(retryBtnEl);

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && cancelable && sig.get() === 'generating') {
      e.preventDefault();
      onCancel?.();
    }
  });

  // Start elapsed timer when generating
  const startTimer = () => {
    elapsedSeconds = 0;
    if (elapsedInterval) clearInterval(elapsedInterval);
    elapsedInterval = setInterval(() => {
      elapsedSeconds += 1;
      updateElapsed();
    }, 1000);
  };

  const stopTimer = () => {
    finalElapsed = elapsedSeconds;
    if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = undefined; }
  };

  // Initial render
  renderSpinner();
  updateStatusText();
  updateElapsed();

  if (sig.get() === 'generating') {
    startTimer();
  }

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-label', `Generation ${s}`);
    root.setAttribute('aria-busy', String(s === 'generating'));
    spinnerEl.setAttribute('data-state', s);
    statusTextEl.setAttribute('data-state', s);
    modelBadgeEl.setAttribute('data-state', s);
    tokenCounterEl.setAttribute('data-state', s);
    retryBtnEl.setAttribute('data-state', s);
    retryBtnEl.style.display = s === 'error' ? '' : 'none';

    renderSpinner();
    updateStatusText();
    updateElapsed();

    if (s === 'generating') {
      startTimer();
    } else {
      stopTimer();
    }

    if (s === 'idle') {
      elapsedSeconds = 0;
      finalElapsed = 0;
    }
  });

  return {
    element: root,
    dispose() { unsub(); if (elapsedInterval) clearInterval(elapsedInterval); root.remove(); },
  };
}

export default GenerationIndicator;
