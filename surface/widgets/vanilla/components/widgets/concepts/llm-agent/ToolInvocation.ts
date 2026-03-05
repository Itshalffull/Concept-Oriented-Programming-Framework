/* ---------------------------------------------------------------------------
 * ToolInvocation — Vanilla implementation
 *
 * Displays a tool call with name, arguments, result, status icon, duration,
 * and retry button. Supports expand/collapse and parallel view/exec states.
 * ------------------------------------------------------------------------- */

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

const STATUS_ICONS: Record<string, string> = { pending: '\u25CB', running: '\u25CF', succeeded: '\u2713', failed: '\u2717' };

export interface ToolInvocationProps {
  [key: string]: unknown;
  className?: string;
  toolName?: string;
  status?: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration?: number;
  destructive?: boolean;
  onRetry?: () => void;
}
export interface ToolInvocationOptions { target: HTMLElement; props: ToolInvocationProps; }

let _toolInvocationUid = 0;

export class ToolInvocation {
  private el: HTMLElement;
  private props: ToolInvocationProps;
  private state: ToolInvocationState = 'collapsed';
  private disposers: Array<() => void> = [];
  private isExpanded = false;

  constructor(options: ToolInvocationOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'tool-invocation');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'article');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'tool-invocation-' + (++_toolInvocationUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = toolInvocationReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<ToolInvocationProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }

  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const { toolName = 'unknown', status = 'pending', arguments: args, result, error, duration, destructive = false } = this.props;
    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('data-status', status);
    this.el.setAttribute('aria-label', `Tool: ${toolName} - ${status}`);
    if (this.props.className) this.el.className = this.props.className;

    // Header (clickable to expand/collapse)
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', this.isExpanded ? 'true' : 'false');

    const toolIcon = document.createElement('span');
    toolIcon.setAttribute('data-part', 'tool-icon');
    toolIcon.setAttribute('aria-hidden', 'true');
    toolIcon.textContent = '\u2699';
    header.appendChild(toolIcon);

    const nameEl = document.createElement('span');
    nameEl.setAttribute('data-part', 'tool-name');
    nameEl.textContent = toolName;
    header.appendChild(nameEl);

    const statusIcon = document.createElement('span');
    statusIcon.setAttribute('data-part', 'status-icon');
    statusIcon.setAttribute('data-status', status);
    statusIcon.textContent = STATUS_ICONS[status] ?? '\u25CB';
    header.appendChild(statusIcon);

    if (duration != null) {
      const dur = document.createElement('span');
      dur.setAttribute('data-part', 'duration-label');
      dur.textContent = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
      header.appendChild(dur);
    }

    if (destructive) {
      const warn = document.createElement('span');
      warn.setAttribute('data-part', 'warning-badge');
      warn.setAttribute('aria-label', 'Destructive tool');
      warn.textContent = '\u26A0';
      header.appendChild(warn);
    }

    const onHeaderClick = () => {
      this.isExpanded = !this.isExpanded;
      this.send(this.isExpanded ? 'EXPAND' : 'COLLAPSE');
      this.rerender();
    };
    header.addEventListener('click', onHeaderClick);
    this.disposers.push(() => header.removeEventListener('click', onHeaderClick));

    const onEnter = () => this.send('HOVER');
    const onLeave = () => this.send('LEAVE');
    header.addEventListener('mouseenter', onEnter);
    header.addEventListener('mouseleave', onLeave);
    this.disposers.push(() => header.removeEventListener('mouseenter', onEnter), () => header.removeEventListener('mouseleave', onLeave));

    this.el.appendChild(header);

    // Body (visible when expanded)
    if (this.isExpanded) {
      const body = document.createElement('div');
      body.setAttribute('data-part', 'body');
      body.setAttribute('data-visible', 'true');

      if (args && Object.keys(args).length > 0) {
        const argsBlock = document.createElement('div');
        argsBlock.setAttribute('data-part', 'arguments-block');
        const argsLabel = document.createElement('span');
        argsLabel.textContent = 'Arguments';
        argsBlock.appendChild(argsLabel);
        const pre = document.createElement('pre');
        try { pre.textContent = JSON.stringify(args, null, 2); } catch { pre.textContent = String(args); }
        argsBlock.appendChild(pre);
        body.appendChild(argsBlock);
      }

      if (result !== undefined) {
        const resultBlock = document.createElement('div');
        resultBlock.setAttribute('data-part', 'result-block');
        const resultLabel = document.createElement('span');
        resultLabel.textContent = 'Result';
        resultBlock.appendChild(resultLabel);
        const pre = document.createElement('pre');
        try { pre.textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2); } catch { pre.textContent = String(result); }
        resultBlock.appendChild(pre);
        body.appendChild(resultBlock);
      }

      if (error) {
        const errBlock = document.createElement('div');
        errBlock.setAttribute('data-part', 'error-block');
        errBlock.setAttribute('role', 'alert');
        errBlock.textContent = error;
        body.appendChild(errBlock);
      }

      if (status === 'failed') {
        const retryBtn = document.createElement('button');
        retryBtn.setAttribute('data-part', 'retry-button');
        retryBtn.setAttribute('type', 'button');
        retryBtn.setAttribute('aria-label', 'Retry tool call');
        retryBtn.textContent = 'Retry';
        const onRetry = () => { this.send('RETRY'); this.props.onRetry?.(); };
        retryBtn.addEventListener('click', onRetry);
        this.disposers.push(() => retryBtn.removeEventListener('click', onRetry));
        body.appendChild(retryBtn);
      }

      this.el.appendChild(body);
    }

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHeaderClick(); }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));
  }
}

export default ToolInvocation;
