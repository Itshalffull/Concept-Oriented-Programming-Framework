import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

export type StreamTextState = 'idle' | 'streaming' | 'complete' | 'stopped';
export type StreamTextEvent =
  | { type: 'STREAM_START' }
  | { type: 'TOKEN' }
  | { type: 'STREAM_END' }
  | { type: 'STOP' };

export function streamTextReducer(state: StreamTextState, event: StreamTextEvent): StreamTextState {
  switch (state) {
    case 'idle':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'streaming':
      if (event.type === 'TOKEN') return 'streaming';
      if (event.type === 'STREAM_END') return 'complete';
      if (event.type === 'STOP') return 'stopped';
      return state;
    case 'complete':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    case 'stopped':
      if (event.type === 'STREAM_START') return 'streaming';
      return state;
    default:
      return state;
  }
}

export interface StreamTextProps { [key: string]: unknown; class?: string; }
export interface StreamTextResult { element: HTMLElement; dispose: () => void; }

export function StreamText(props: StreamTextProps): StreamTextResult {
  const streaming = Boolean(props.streaming);
  const sig = surfaceCreateSignal<StreamTextState>(streaming ? 'streaming' : 'idle');
  const send = (event: StreamTextEvent) => { sig.set(streamTextReducer(sig.get(), event)); };

  const content = String(props.content ?? '');
  const renderMarkdown = props.renderMarkdown !== false;
  const cursorStyle = String(props.cursorStyle ?? 'bar');
  const onStop = props.onStop as (() => void) | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'stream-text');
  root.setAttribute('data-part', 'root');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Streaming response');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-busy', streaming ? 'true' : 'false');
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Text block
  const textBlockEl = document.createElement('div');
  textBlockEl.setAttribute('data-part', 'text-block');
  textBlockEl.setAttribute('data-state', sig.get());
  textBlockEl.setAttribute('data-markdown', renderMarkdown ? 'true' : 'false');
  textBlockEl.style.overflow = 'auto';
  root.appendChild(textBlockEl);

  // Content element
  if (renderMarkdown) {
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = content;
    textBlockEl.appendChild(contentDiv);
  } else {
    const contentSpan = document.createElement('span');
    contentSpan.style.whiteSpace = 'pre-wrap';
    contentSpan.textContent = content;
    textBlockEl.appendChild(contentSpan);
  }

  // Cursor
  const cursorEl = document.createElement('span');
  cursorEl.setAttribute('data-part', 'cursor');
  cursorEl.setAttribute('data-style', cursorStyle);
  cursorEl.setAttribute('data-visible', streaming ? 'true' : 'false');
  cursorEl.setAttribute('data-state', sig.get());
  cursorEl.setAttribute('aria-hidden', 'true');
  cursorEl.style.display = streaming ? 'inline-block' : 'none';
  if (cursorStyle === 'bar') {
    cursorEl.style.width = '2px';
    cursorEl.style.height = '1.2em';
    cursorEl.style.verticalAlign = 'text-bottom';
    cursorEl.style.backgroundColor = 'currentColor';
  } else if (cursorStyle === 'block') {
    cursorEl.style.width = '0.6em';
    cursorEl.style.height = '1.2em';
    cursorEl.style.verticalAlign = 'text-bottom';
    cursorEl.style.backgroundColor = 'currentColor';
    cursorEl.style.opacity = '0.7';
  } else {
    cursorEl.style.width = '0.6em';
    cursorEl.style.height = '2px';
    cursorEl.style.verticalAlign = 'baseline';
    cursorEl.style.backgroundColor = 'currentColor';
  }
  textBlockEl.appendChild(cursorEl);

  // Stop button
  const stopButtonEl = document.createElement('button');
  stopButtonEl.setAttribute('type', 'button');
  stopButtonEl.setAttribute('data-part', 'stop-button');
  stopButtonEl.setAttribute('data-state', sig.get());
  stopButtonEl.setAttribute('data-visible', streaming ? 'true' : 'false');
  stopButtonEl.setAttribute('role', 'button');
  stopButtonEl.setAttribute('aria-label', 'Stop generation');
  stopButtonEl.setAttribute('tabindex', '0');
  stopButtonEl.textContent = 'Stop';
  stopButtonEl.style.display = streaming ? '' : 'none';
  stopButtonEl.addEventListener('click', () => {
    if (sig.get() !== 'streaming') return;
    send({ type: 'STOP' });
    onStop?.();
  });
  root.appendChild(stopButtonEl);

  // Keyboard handler
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (sig.get() === 'streaming') {
        send({ type: 'STOP' });
        onStop?.();
      }
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    root.setAttribute('aria-busy', s === 'streaming' ? 'true' : 'false');
    textBlockEl.setAttribute('data-state', s);
    cursorEl.setAttribute('data-state', s);
    cursorEl.style.display = s === 'streaming' ? 'inline-block' : 'none';
    cursorEl.setAttribute('data-visible', s === 'streaming' ? 'true' : 'false');
    stopButtonEl.setAttribute('data-state', s);
    stopButtonEl.style.display = s === 'streaming' ? '' : 'none';
    stopButtonEl.setAttribute('data-visible', s === 'streaming' ? 'true' : 'false');
  });

  return {
    element: root,
    dispose() { unsub(); root.remove(); },
  };
}

export default StreamText;
