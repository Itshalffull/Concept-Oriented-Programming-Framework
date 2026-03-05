/* ---------------------------------------------------------------------------
 * StreamText — Vanilla implementation
 *
 * Renders streaming text content with a cursor indicator, auto-scroll,
 * and stop button. Supports bar/block/underline cursor styles.
 * ------------------------------------------------------------------------- */

export type StreamTextState = 'idle' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming' as any;
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming' as any;
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming' as any;
      return state;
    default:
      return state;
  }
}

export interface StreamTextProps {
  [key: string]: unknown;
  className?: string;
  content?: string;
  streaming?: boolean;
  cursorStyle?: 'bar' | 'block' | 'underline';
  autoScroll?: boolean;
  onStop?: () => void;
}
export interface StreamTextOptions { target: HTMLElement; props: StreamTextProps; }

let _streamTextUid = 0;

export class StreamText {
  private el: HTMLElement;
  private props: StreamTextProps;
  private state: StreamTextState = 'idle';
  private disposers: Array<() => void> = [];

  constructor(options: StreamTextOptions) {
    this.props = { ...options.props };
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'stream-text');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'log');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'stream-text-' + (++_streamTextUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  send(type: string): void {
    this.state = streamTextReducer(this.state, { type } as any);
    this.el.setAttribute('data-state', this.state);
  }

  update(props: Partial<StreamTextProps>): void {
    Object.assign(this.props, props);
    this.cleanup();
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void {
    this.cleanup();
    this.el.remove();
  }

  private cleanup(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  private render(): void {
    const { content = '', streaming = false, cursorStyle = 'bar', autoScroll = true } = this.props;
    const isStreaming = streaming;

    this.el.setAttribute('data-state', this.state);
    this.el.setAttribute('aria-busy', isStreaming ? 'true' : 'false');
    if (this.props.className) this.el.className = this.props.className;

    // Keyboard: Escape to stop
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        this.send('STOP');
        this.props.onStop?.();
        this.cleanup();
        this.el.innerHTML = '';
        this.render();
      }
    };
    this.el.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => this.el.removeEventListener('keydown', onKeyDown));

    // Text block
    const textBlock = document.createElement('div');
    textBlock.setAttribute('data-part', 'text-block');
    textBlock.textContent = content;
    this.el.appendChild(textBlock);

    // Cursor (only while streaming)
    if (isStreaming) {
      const cursor = document.createElement('span');
      cursor.setAttribute('data-part', 'cursor');
      cursor.setAttribute('data-style', cursorStyle);
      cursor.setAttribute('aria-hidden', 'true');
      const cursorChars: Record<string, string> = { bar: '|', block: '\u2588', underline: '_' };
      cursor.textContent = cursorChars[cursorStyle] ?? '|';
      textBlock.appendChild(cursor);
    }

    // Stop button (only while streaming)
    if (isStreaming) {
      const stopButton = document.createElement('button');
      stopButton.setAttribute('data-part', 'stop-button');
      stopButton.setAttribute('type', 'button');
      stopButton.setAttribute('aria-label', 'Stop streaming');
      stopButton.textContent = 'Stop';
      const onStop = () => {
        this.send('STOP');
        this.props.onStop?.();
        this.cleanup();
        this.el.innerHTML = '';
        this.render();
      };
      stopButton.addEventListener('click', onStop);
      this.disposers.push(() => stopButton.removeEventListener('click', onStop));
      this.el.appendChild(stopButton);
    }

    // Auto-scroll
    if (autoScroll && isStreaming) {
      this.el.scrollTop = this.el.scrollHeight;
    }
  }
}

export default StreamText;
