/* ---------------------------------------------------------------------------
 * GenerationIndicator — Vanilla implementation
 *
 * Shows generation status with spinner, model badge, token counter,
 * elapsed time, cancel (Escape), and retry on error.
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

export interface GenerationIndicatorProps {
  [key: string]: unknown;
  className?: string;
  status?: string;
  model?: string;
  tokenCount?: number;
  startedAt?: string;
  errorMessage?: string;
  variant?: 'dots' | 'spinner' | 'bar';
  onCancel?: () => void;
  onRetry?: () => void;
}
export interface GenerationIndicatorOptions { target: HTMLElement; props: GenerationIndicatorProps; }

let _generationIndicatorUid = 0;

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export class GenerationIndicator {
  private el: HTMLElement;
  private props: GenerationIndicatorProps;
  private state: GenerationIndicatorState = 'idle';
  private disposers: Array<() => void> = [];
  private elapsed = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: GenerationIndicatorOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'generation-indicator');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'generation-indicator-' + (++_generationIndicatorUid);
    this.syncState();
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = generationIndicatorReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<GenerationIndicatorProps>): void { Object.assign(this.props, props); this.syncState(); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); if (this.timer) clearInterval(this.timer); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private syncState(): void {
    const { status } = this.props;
    if (status === 'generating' && this.state === 'idle') this.send('START');
    if (status === 'complete' && this.state === 'generating') this.send('COMPLETE');
    if (status === 'error' && this.state === 'generating') this.send('ERROR');
  }

  private render(): void {
    const { model = '', tokenCount = 0, startedAt, errorMessage, variant = 'dots' } = this.props;
    const isGenerating = this.state === 'generating';
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('aria-busy', isGenerating ? 'true' : 'false');
    if (this.props.className) this.el.className = this.props.className;

    // Elapsed timer
    if (isGenerating && startedAt) {
      const start = new Date(startedAt as string).getTime();
      const tick = () => { this.elapsed = Date.now() - start; const el = this.el.querySelector('[data-part="elapsed"]'); if (el) el.textContent = formatElapsed(this.elapsed); };
      tick();
      this.timer = setInterval(tick, 1000);
      this.disposers.push(() => { if (this.timer) { clearInterval(this.timer); this.timer = null; } });
    }

    // Escape to cancel
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isGenerating) { e.preventDefault(); this.send('ERROR'); this.props.onCancel?.(); this.rerender(); }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Spinner
    if (isGenerating) {
      const spinner = document.createElement('div');
      spinner.setAttribute('data-part', 'spinner');
      spinner.setAttribute('data-variant', variant);
      spinner.setAttribute('aria-hidden', 'true');
      spinner.textContent = variant === 'dots' ? '\u2022\u2022\u2022' : variant === 'bar' ? '\u2588\u2588' : '\u25CF';
      this.el.appendChild(spinner);
    }

    // Status text
    const statusText = document.createElement('span');
    statusText.setAttribute('data-part', 'status-text');
    statusText.textContent = this.state === 'generating' ? 'Generating...' : this.state === 'complete' ? 'Complete' : this.state === 'error' ? 'Error' : 'Ready';
    this.el.appendChild(statusText);

    // Model badge
    if (model) {
      const badge = document.createElement('span');
      badge.setAttribute('data-part', 'model-badge');
      badge.textContent = model;
      this.el.appendChild(badge);
    }

    // Token counter
    if (tokenCount > 0 || isGenerating) {
      const counter = document.createElement('span');
      counter.setAttribute('data-part', 'token-counter');
      counter.textContent = `${tokenCount} tokens`;
      this.el.appendChild(counter);
    }

    // Elapsed
    if (isGenerating || this.state === 'complete') {
      const elapsedEl = document.createElement('span');
      elapsedEl.setAttribute('data-part', 'elapsed');
      elapsedEl.textContent = formatElapsed(this.elapsed);
      this.el.appendChild(elapsedEl);
    }

    // Error + Retry
    if (this.state === 'error') {
      const errEl = document.createElement('div');
      errEl.setAttribute('data-part', 'error-message');
      errEl.setAttribute('role', 'alert');
      errEl.textContent = errorMessage ?? 'Generation failed';
      this.el.appendChild(errEl);
      const retryBtn = document.createElement('button');
      retryBtn.setAttribute('data-part', 'retry-button');
      retryBtn.setAttribute('type', 'button');
      retryBtn.textContent = 'Retry';
      const onRetry = () => { this.send('RETRY'); this.props.onRetry?.(); this.rerender(); };
      retryBtn.addEventListener('click', onRetry);
      this.disposers.push(() => retryBtn.removeEventListener('click', onRetry));
      this.el.appendChild(retryBtn);
    }
  }
}

export default GenerationIndicator;
