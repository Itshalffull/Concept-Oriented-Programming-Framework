/* ---------------------------------------------------------------------------
 * ToolCallDetail — Vanilla implementation
 *
 * Detailed view of a tool call with collapsible arguments/result panels,
 * status badge, timing bar, token badge, error panel, and retry button.
 * ------------------------------------------------------------------------- */

export type ToolCallDetailState = 'idle' | 'retrying';
export type ToolCallDetailEvent = | { type: 'EXPAND_ARGS' } | { type: 'EXPAND_RESULT' } | { type: 'RETRY' } | { type: 'RETRY_COMPLETE' } | { type: 'RETRY_ERROR' };

export function toolCallDetailReducer(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState {
  switch (state) {
    case 'idle': if (event.type === 'RETRY') return 'retrying'; return state;
    case 'retrying': if (event.type === 'RETRY_COMPLETE' || event.type === 'RETRY_ERROR') return 'idle'; return state;
    default: return state;
  }
}

export interface ToolCallDetailProps {
  [key: string]: unknown; className?: string;
  toolName?: string; status?: string;
  arguments?: Record<string, unknown>; result?: unknown; error?: string;
  duration?: number; tokens?: number;
  onRetry?: () => void; onCopy?: () => void;
}
export interface ToolCallDetailOptions { target: HTMLElement; props: ToolCallDetailProps; }

let _toolCallDetailUid = 0;

export class ToolCallDetail {
  private el: HTMLElement;
  private props: ToolCallDetailProps;
  private state: ToolCallDetailState = 'idle';
  private disposers: Array<() => void> = [];
  private argsExpanded = false;
  private resultExpanded = false;

  constructor(options: ToolCallDetailOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'tool-call-detail');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'article');
    this.el.setAttribute('aria-label', 'Tool call detail');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'tool-call-detail-' + (++_toolCallDetailUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = toolCallDetailReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<ToolCallDetailProps>): void { Object.assign(this.props, props); this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const { toolName = '', status = 'pending', arguments: args, result, error, duration, tokens } = this.props;
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-status', status);
    if (this.props.className) this.el.className = this.props.className;

    // Header
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    const nameEl = document.createElement('span');
    nameEl.setAttribute('data-part', 'tool-name');
    nameEl.textContent = toolName;
    header.appendChild(nameEl);
    const badge = document.createElement('span');
    badge.setAttribute('data-part', 'status-badge');
    badge.setAttribute('data-status', status);
    badge.textContent = status;
    header.appendChild(badge);
    this.el.appendChild(header);

    // Arguments panel
    if (args && Object.keys(args).length > 0) {
      const argsPanel = document.createElement('div');
      argsPanel.setAttribute('data-part', 'arguments-panel');
      argsPanel.setAttribute('data-expanded', this.argsExpanded ? 'true' : 'false');
      const argsToggle = document.createElement('button');
      argsToggle.setAttribute('type', 'button');
      argsToggle.setAttribute('aria-expanded', this.argsExpanded ? 'true' : 'false');
      argsToggle.textContent = `${this.argsExpanded ? '\u25BC' : '\u25B6'} Arguments`;
      const onToggleArgs = () => { this.argsExpanded = !this.argsExpanded; this.rerender(); };
      argsToggle.addEventListener('click', onToggleArgs);
      this.disposers.push(() => argsToggle.removeEventListener('click', onToggleArgs));
      argsPanel.appendChild(argsToggle);
      if (this.argsExpanded) {
        const pre = document.createElement('pre');
        try { pre.textContent = JSON.stringify(args, null, 2); } catch { pre.textContent = String(args); }
        argsPanel.appendChild(pre);
      }
      this.el.appendChild(argsPanel);
    }

    // Result panel
    if (result !== undefined) {
      const resultPanel = document.createElement('div');
      resultPanel.setAttribute('data-part', 'result-panel');
      resultPanel.setAttribute('data-expanded', this.resultExpanded ? 'true' : 'false');
      const resultToggle = document.createElement('button');
      resultToggle.setAttribute('type', 'button');
      resultToggle.setAttribute('aria-expanded', this.resultExpanded ? 'true' : 'false');
      resultToggle.textContent = `${this.resultExpanded ? '\u25BC' : '\u25B6'} Result`;
      const onToggleResult = () => { this.resultExpanded = !this.resultExpanded; this.rerender(); };
      resultToggle.addEventListener('click', onToggleResult);
      this.disposers.push(() => resultToggle.removeEventListener('click', onToggleResult));
      resultPanel.appendChild(resultToggle);
      if (this.resultExpanded) {
        const pre = document.createElement('pre');
        try { pre.textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2); } catch { pre.textContent = String(result); }
        resultPanel.appendChild(pre);
      }
      this.el.appendChild(resultPanel);
    }

    // Timing bar
    if (duration != null) {
      const timingBar = document.createElement('div');
      timingBar.setAttribute('data-part', 'timing-bar');
      timingBar.textContent = `Duration: ${duration < 1000 ? duration + 'ms' : (duration / 1000).toFixed(1) + 's'}`;
      this.el.appendChild(timingBar);
    }

    // Token badge
    if (tokens != null) {
      const tokenBadge = document.createElement('span');
      tokenBadge.setAttribute('data-part', 'token-badge');
      tokenBadge.textContent = `${tokens} tokens`;
      this.el.appendChild(tokenBadge);
    }

    // Error panel
    if (error) {
      const errorPanel = document.createElement('div');
      errorPanel.setAttribute('data-part', 'error-panel');
      errorPanel.setAttribute('role', 'alert');
      errorPanel.textContent = error;
      this.el.appendChild(errorPanel);
    }

    // Retry button
    if (status === 'failed' || error) {
      const retryBtn = document.createElement('button');
      retryBtn.setAttribute('data-part', 'retry-button');
      retryBtn.setAttribute('type', 'button');
      retryBtn.setAttribute('aria-label', 'Retry tool call');
      retryBtn.textContent = this.state === 'retrying' ? 'Retrying...' : 'Retry';
      if (this.state === 'retrying') retryBtn.setAttribute('disabled', '');
      const onRetry = () => { this.send('RETRY'); this.props.onRetry?.(); };
      retryBtn.addEventListener('click', onRetry);
      this.disposers.push(() => retryBtn.removeEventListener('click', onRetry));
      this.el.appendChild(retryBtn);
    }
  }
}

export default ToolCallDetail;
