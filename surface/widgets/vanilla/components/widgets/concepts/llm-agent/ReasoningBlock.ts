/* ---------------------------------------------------------------------------
 * ReasoningBlock — Vanilla widget
 *
 * Collapsible block showing LLM reasoning/thinking content with expand/
 * collapse toggle, streaming support, and duration display.
 * States: collapsed (initial), expanded, streaming
 * ------------------------------------------------------------------------- */

export type ReasoningBlockState = 'collapsed' | 'expanded' | 'streaming';
export type ReasoningBlockEvent =
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'TOGGLE' }
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' };

export function reasoningBlockReducer(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState {
  switch (state) {
    case 'collapsed':
      if (event.type === 'EXPAND' || event.type === 'TOGGLE') return 'expanded';
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'expanded':
      if (event.type === 'COLLAPSE' || event.type === 'TOGGLE') return 'collapsed';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'collapsed';
      return state;
    default:
      return state;
  }
}

export interface ReasoningBlockProps {
  /** Reasoning / chain-of-thought content (plain text or markdown). */
  content: string;
  /** Controlled collapsed state. */
  collapsed: boolean;
  /** Callback when toggle is triggered. */
  onToggle?: () => void;
  /** Start in expanded state. */
  defaultExpanded?: boolean;
  /** Show the duration label. */
  showDuration?: boolean;
  /** Whether content is currently streaming. */
  streaming?: boolean;
  /** Time spent reasoning, in milliseconds. */
  duration?: number | undefined;
  className?: string;
  [key: string]: unknown;
}
export interface ReasoningBlockOptions { target: HTMLElement; props: ReasoningBlockProps; }

let _reasoningBlockUid = 0;

export class ReasoningBlock {
  private el: HTMLElement;
  private props: ReasoningBlockProps;
  private state: ReasoningBlockState = 'collapsed';
  private disposers: Array<() => void> = [];

  constructor(options: ReasoningBlockOptions) {
    this.props = { ...options.props };
    const streaming = this.props.streaming ?? false;
    const defaultExpanded = this.props.defaultExpanded ?? false;
    this.state = streaming ? 'streaming' : defaultExpanded ? 'expanded' : 'collapsed';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'reasoning-block');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Model reasoning');
    this.el.id = 'reasoning-block-' + (++_reasoningBlockUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  private send(ev: ReasoningBlockEvent): void {
    this.state = reasoningBlockReducer(this.state, ev);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<ReasoningBlockProps>): void {
    const wasStreaming = this.props.streaming ?? false;
    Object.assign(this.props, props);
    const nowStreaming = this.props.streaming ?? false;
    // Sync streaming prop to state machine
    if (nowStreaming && this.state !== 'streaming') {
      this.send({ type: 'STREAM_START' });
    } else if (!nowStreaming && wasStreaming && this.state === 'streaming') {
      this.send({ type: 'STREAM_END' });
    }
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { this.cleanup(); this.el.remove(); }

  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }
  private rerender(): void { this.cleanup(); this.el.innerHTML = ''; this.render(); }

  private render(): void {
    const content = this.props.content ?? '';
    const streaming = this.props.streaming ?? false;
    const showDuration = this.props.showDuration !== false;
    const duration = this.props.duration;
    const isBodyVisible = this.state === 'expanded' || this.state === 'streaming';
    const headerText = this.state === 'streaming' ? 'Thinking...' : 'Reasoning';

    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;

    // Header — clickable to toggle expand/collapse
    const header = document.createElement('div');
    header.setAttribute('data-part', 'header');
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', isBodyVisible ? 'true' : 'false');
    header.setAttribute('aria-label', 'Toggle reasoning details');
    header.tabIndex = 0;

    const icon = document.createElement('div');
    icon.setAttribute('data-part', 'header-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\uD83E\uDDE0'; // brain emoji
    header.appendChild(icon);

    const text = document.createElement('span');
    text.setAttribute('data-part', 'header-text');
    text.textContent = headerText;
    header.appendChild(text);

    if (showDuration && this.state !== 'streaming' && duration != null) {
      const dur = document.createElement('span');
      dur.setAttribute('data-part', 'duration');
      dur.setAttribute('data-visible', 'true');
      dur.textContent = `${duration}ms`;
      header.appendChild(dur);
    }

    const handleToggle = () => {
      if (this.state === 'streaming') return; // Cannot toggle during streaming
      this.send({ type: 'TOGGLE' });
      this.props.onToggle?.();
      this.rerender();
    };

    header.addEventListener('click', handleToggle);
    this.disposers.push(() => header.removeEventListener('click', handleToggle));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      }
    };
    header.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => header.removeEventListener('keydown', onKeyDown));

    this.el.appendChild(header);

    // Body — visible when expanded or streaming
    const body = document.createElement('div');
    body.setAttribute('data-part', 'body');
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', 'Reasoning content');
    body.setAttribute('data-visible', isBodyVisible ? 'true' : 'false');

    if (isBodyVisible) {
      const contentEl = document.createElement('div');
      contentEl.setAttribute('data-part', 'content');
      contentEl.textContent = content;
      body.appendChild(contentEl);
    }
    this.el.appendChild(body);

    // Duration placeholder during streaming
    if (showDuration && this.state === 'streaming') {
      const durPlaceholder = document.createElement('span');
      durPlaceholder.setAttribute('data-part', 'duration');
      durPlaceholder.setAttribute('data-visible', 'false');
      durPlaceholder.setAttribute('aria-hidden', 'true');
      this.el.appendChild(durPlaceholder);
    }
  }
}

export default ReasoningBlock;
