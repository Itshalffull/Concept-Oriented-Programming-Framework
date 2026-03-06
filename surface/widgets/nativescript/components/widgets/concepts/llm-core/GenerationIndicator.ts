import { StackLayout, Label, Button, FlexboxLayout, ActivityIndicator } from '@nativescript/core';

/* ---------------------------------------------------------------------------
 * GenerationIndicator state machine
 * States: idle, generating, complete, error
 * ------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface GenerationIndicatorProps {
  status: GenerationIndicatorState;
  model?: string;
  tokenCount?: number;
  showTokens?: boolean;
  showModel?: boolean;
  showElapsed?: boolean;
  variant?: 'dots' | 'spinner' | 'bar';
  cancelable?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}

/* ---------------------------------------------------------------------------
 * Widget
 * ------------------------------------------------------------------------- */

export function createGenerationIndicator(props: GenerationIndicatorProps): { view: StackLayout; dispose: () => void } {
  const {
    status,
    model,
    tokenCount,
    showTokens = true,
    showModel = true,
    showElapsed = true,
    cancelable = false,
    onCancel,
    onRetry,
  } = props;

  let state: GenerationIndicatorState = 'idle';
  let elapsedSeconds = 0;
  let finalElapsed = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const disposers: (() => void)[] = [];

  function send(event: GenerationIndicatorEvent) {
    state = generationIndicatorReducer(state, event);
    update();
  }

  // Sync with status prop
  function syncStatus() {
    switch (status) {
      case 'generating':
        if (state === 'idle' || state === 'complete' || state === 'error') {
          send({ type: state === 'error' ? 'RETRY' : 'START' });
        }
        break;
      case 'complete':
        if (state === 'generating') send({ type: 'COMPLETE' });
        break;
      case 'error':
        if (state === 'generating') send({ type: 'ERROR' });
        break;
      case 'idle':
        if (state === 'complete' || state === 'error') send({ type: 'RESET' });
        break;
    }
  }

  const root = new StackLayout();
  root.className = 'generation-indicator';
  root.automationText = `Generation ${status}`;

  const mainRow = new FlexboxLayout();
  mainRow.className = 'generation-indicator-row';
  mainRow.flexDirection = 'row' as any;
  mainRow.alignItems = 'center' as any;

  // Spinner
  const spinner = new ActivityIndicator();
  spinner.className = 'generation-indicator-spinner';
  spinner.busy = false;
  spinner.width = 20;
  spinner.height = 20;
  spinner.visibility = 'collapse' as any;
  mainRow.addChild(spinner);

  // Status text
  const statusText = new Label();
  statusText.className = 'generation-indicator-status';
  statusText.text = '';
  mainRow.addChild(statusText);

  // Model badge
  const modelBadge = new Label();
  modelBadge.className = 'generation-indicator-model';
  modelBadge.visibility = 'collapse' as any;
  if (showModel && model) {
    modelBadge.text = model;
    modelBadge.visibility = 'visible' as any;
  }
  mainRow.addChild(modelBadge);

  // Token counter
  const tokenLabel = new Label();
  tokenLabel.className = 'generation-indicator-tokens';
  tokenLabel.visibility = 'collapse' as any;
  if (showTokens && tokenCount != null) {
    tokenLabel.text = `${tokenCount} tokens`;
    tokenLabel.visibility = 'visible' as any;
    tokenLabel.automationText = `${tokenCount} tokens generated`;
  }
  mainRow.addChild(tokenLabel);

  // Elapsed time
  const elapsedLabel = new Label();
  elapsedLabel.className = 'generation-indicator-elapsed';
  elapsedLabel.visibility = 'collapse' as any;
  mainRow.addChild(elapsedLabel);

  root.addChild(mainRow);

  // Retry button (error state)
  const retryBtn = new Button();
  retryBtn.className = 'generation-indicator-retry';
  retryBtn.text = 'Retry';
  retryBtn.automationText = 'Retry generation';
  retryBtn.visibility = 'collapse' as any;
  const retryHandler = () => {
    if (state === 'error') onRetry?.();
  };
  retryBtn.on('tap', retryHandler);
  disposers.push(() => retryBtn.off('tap', retryHandler));
  root.addChild(retryBtn);

  function stopInterval() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function startInterval() {
    stopInterval();
    elapsedSeconds = 0;
    intervalId = setInterval(() => {
      elapsedSeconds += 1;
      if (showElapsed) {
        elapsedLabel.text = formatElapsed(elapsedSeconds);
      }
    }, 1000);
  }

  function update() {
    const isGenerating = state === 'generating';

    // Spinner
    spinner.busy = isGenerating;
    spinner.visibility = (isGenerating ? 'visible' : 'collapse') as any;

    // Status text
    switch (state) {
      case 'generating': statusText.text = 'Generating...'; break;
      case 'complete': statusText.text = 'Complete'; break;
      case 'error': statusText.text = 'Error'; break;
      default: statusText.text = ''; break;
    }

    // Elapsed
    if (showElapsed && (state === 'generating' || state === 'complete')) {
      elapsedLabel.visibility = 'visible' as any;
      if (state === 'generating') {
        elapsedLabel.text = formatElapsed(elapsedSeconds);
      } else {
        elapsedLabel.text = formatElapsed(finalElapsed);
      }
    } else {
      elapsedLabel.visibility = 'collapse' as any;
    }

    // Timer management
    if (state === 'generating' && intervalId === null) {
      startInterval();
    }
    if (state === 'complete' || state === 'error') {
      finalElapsed = elapsedSeconds;
      stopInterval();
    }
    if (state === 'idle') {
      elapsedSeconds = 0;
      finalElapsed = 0;
      stopInterval();
    }

    // Retry button
    retryBtn.visibility = (state === 'error' ? 'visible' : 'collapse') as any;

    // Accessibility
    root.automationText = `Generation ${state}`;
  }

  // Initial sync
  syncStatus();

  disposers.push(() => stopInterval());

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createGenerationIndicator;
